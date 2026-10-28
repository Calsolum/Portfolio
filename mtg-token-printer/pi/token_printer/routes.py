"""Flask routes the phone app talks to.

The label server owns the printer, so this blueprint never touches Bluetooth.
It is handed three small functions when it's registered:

- submit(image, copies) -> job id: queue a print on the existing job loop
- status(job id) -> dict: report that job, normalised by `normalize_status`
- label_size() -> (width, height): the preset that's loaded now

The app only relies on the JSON shapes defined here, so the label server's own
routes can change without breaking it.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Callable

from flask import Blueprint, jsonify, request, send_file
from PIL import Image

from .layout import HEIGHT, WIDTH, render_token
from .scryfall import Scryfall, ScryfallError

MAX_COPIES = 10
API_VERSION = 1
STATES = {"queued", "printing", "done", "failed"}


class BadRequest(Exception):
    pass


def normalize_status(raw: dict | None) -> dict:
    """Map a label-server job record to {state, error}.

    Unknown states count as "printing" so the app keeps polling, and a missing
    job counts as failed so it stops.
    """
    if not raw:
        return {"state": "failed", "error": "The printer lost track of that job."}
    state = str(raw.get("state") or raw.get("status") or "").lower()
    aliases = {
        "pending": "queued", "waiting": "queued",
        "running": "printing", "connecting": "printing", "sending": "printing",
        "complete": "done", "completed": "done", "success": "done", "ok": "done",
        "error": "failed", "cancelled": "failed", "canceled": "failed",
    }
    state = aliases.get(state, state)
    if state not in STATES:
        state = "printing"
    error = raw.get("error") or raw.get("message") if state == "failed" else None
    return {"state": state, "error": error or ("Print failed." if state == "failed" else None)}


def custom_token(data: dict) -> dict:
    name = str(data.get("name") or "").strip()
    if not name:
        raise BadRequest("Give the token a name.")
    token = {
        "name": name[:60],
        "type_line": str(data.get("type_line") or "Token").strip()[:80],
        "text": str(data.get("text") or "").strip()[:600],
        "power": str(data.get("power") or "").strip()[:4] or None,
        "toughness": str(data.get("toughness") or "").strip()[:4] or None,
        "artist": None,
    }
    return token


def create_blueprint(
    submit: Callable[[Image.Image, int], str],
    status: Callable[[str], dict | None],
    label_size: Callable[[], tuple[int, int]] = lambda: (WIDTH, HEIGHT),
    cache_dir: Path = Path.home() / ".cache" / "mtg-tokens",
    margin: int = 20,
    x_shift: int = 0,
    scryfall: Scryfall | None = None,
) -> Blueprint:
    bp = Blueprint("tokens", __name__)
    sf = scryfall or Scryfall(cache_dir)

    def resolve(data: dict) -> tuple[dict, Image.Image | None]:
        if data.get("custom"):
            return custom_token(data["custom"]), None
        card_id = str(data.get("id") or "")
        if not card_id:
            raise BadRequest("Pick a token first.")
        card = sf.card(card_id)
        return card, sf.art(card.get("art_url"))

    def render(data: dict) -> Image.Image:
        size = tuple(label_size())
        if size != (WIDTH, HEIGHT):
            raise BadRequest("Load the 50×80 mm labels and pick that size on the Kitchen Hub first.")
        token, art = resolve(data)
        return render_token(token, art, size=size, margin=margin, x_shift=x_shift)

    @bp.errorhandler(BadRequest)
    def bad_request(exc):
        return jsonify(error=str(exc)), 400

    @bp.errorhandler(ScryfallError)
    def scryfall_failed(exc):
        return jsonify(error=str(exc)), 502

    @bp.get("/tokens/health")
    def health():
        width, height = label_size()
        return jsonify(ok=True, api=API_VERSION, label={"width": width, "height": height},
                       ready=(width, height) == (WIDTH, HEIGHT))

    @bp.get("/tokens/search")
    def search():
        return jsonify(results=sf.search(request.args.get("q", "")))

    @bp.post("/preview/token")
    def preview():
        buf = io.BytesIO()
        render(request.get_json(silent=True) or {}).save(buf, "PNG")
        buf.seek(0)
        return send_file(buf, mimetype="image/png")

    @bp.post("/print/token")
    def print_token():
        data = request.get_json(silent=True) or {}
        try:
            copies = int(data.get("copies", 1))
        except (TypeError, ValueError):
            raise BadRequest("Copies must be a number.")
        if not 1 <= copies <= MAX_COPIES:
            raise BadRequest(f"Print between 1 and {MAX_COPIES} copies.")
        image = render(data)
        try:
            job = submit(image, copies)
        except Exception as exc:  # the printer side failed to queue it
            return jsonify(error=f"Print failed: {exc}"), 503
        return jsonify(job=str(job)), 202

    @bp.get("/print/token/<job>")
    def job_status(job):
        return jsonify(normalize_status(status(job)))

    return bp
