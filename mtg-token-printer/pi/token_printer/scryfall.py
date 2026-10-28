"""Small Scryfall client for token lookups, with a disk cache.

Scryfall asks API users to send a User-Agent and Accept header, keep to about
10 requests a second, and cache what they fetch. Token data rarely changes, so
cards and art are cached on disk indefinitely.
"""

from __future__ import annotations

import hashlib
import io
import json
import threading
import time
from pathlib import Path

import requests
from PIL import Image

API = "https://api.scryfall.com"
USER_AGENT = "KitchenHubTokenPrinter/1.0"
MIN_INTERVAL = 0.1  # seconds between requests


class ScryfallError(Exception):
    """A lookup failed; the message is safe to show to the user."""


def summarize(card: dict) -> dict:
    """Reduce a Scryfall card object to the fields the label needs.

    Double-faced tokens keep their text and art on the first face, so the
    first face fills in anything missing at the top level.
    """
    face = (card.get("card_faces") or [{}])[0]

    def pick(key):
        return card.get(key) if card.get(key) is not None else face.get(key)

    images = card.get("image_uris") or face.get("image_uris") or {}
    return {
        "id": card["id"],
        "name": face.get("name") or card.get("name", ""),
        "type_line": face.get("type_line") or card.get("type_line", ""),
        "text": pick("oracle_text") or "",
        "power": pick("power"),
        "toughness": pick("toughness"),
        "colors": pick("colors") or [],
        "artist": pick("artist") or "",
        "set_name": card.get("set_name", ""),
        "art_url": images.get("art_crop"),
        "thumb_url": images.get("small"),
    }


class Scryfall:
    def __init__(self, cache_dir: Path, session: requests.Session | None = None):
        self.cache_dir = Path(cache_dir)
        (self.cache_dir / "cards").mkdir(parents=True, exist_ok=True)
        (self.cache_dir / "art").mkdir(parents=True, exist_ok=True)
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
        self._lock = threading.Lock()
        self._last = 0.0

    def _get(self, url: str, **params) -> requests.Response:
        with self._lock:
            wait = MIN_INTERVAL - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
        try:
            return self.session.get(url, params=params or None, timeout=10)
        except requests.RequestException as exc:
            raise ScryfallError("Couldn't reach Scryfall. Is the Pi online?") from exc

    def search(self, query: str, limit: int = 40) -> list[dict]:
        """Tokens whose name or type matches the query, newest printings first."""
        query = query.strip()
        if not query:
            return []
        resp = self._get(
            f"{API}/cards/search",
            q=f"is:token ({query})",
            unique="art",
            order="released",
            dir="desc",
        )
        if resp.status_code == 404:  # Scryfall's answer for "no matches"
            return []
        if resp.status_code != 200:
            raise ScryfallError(f"Scryfall search failed ({resp.status_code}).")
        cards = [summarize(c) for c in resp.json().get("data", [])[:limit]]
        for card in cards:
            self._write_card(card)
        return cards

    def card(self, card_id: str) -> dict:
        cached = self._card_path(card_id)
        if cached.exists():
            return json.loads(cached.read_text())
        resp = self._get(f"{API}/cards/{card_id}")
        if resp.status_code == 404:
            raise ScryfallError("That token isn't on Scryfall.")
        if resp.status_code != 200:
            raise ScryfallError(f"Scryfall lookup failed ({resp.status_code}).")
        card = summarize(resp.json())
        self._write_card(card)
        return card

    def art(self, url: str | None) -> Image.Image | None:
        """The token's art crop, or None when it has no art or the fetch fails."""
        if not url:
            return None
        path = self.cache_dir / "art" / (hashlib.sha1(url.encode()).hexdigest() + ".jpg")
        if path.exists():
            return Image.open(path).convert("RGB")
        try:
            resp = self._get(url)
        except ScryfallError:
            return None
        if resp.status_code != 200:
            return None
        path.write_bytes(resp.content)
        return Image.open(io.BytesIO(resp.content)).convert("RGB")

    def _card_path(self, card_id: str) -> Path:
        # Scryfall ids are UUIDs; anything else never touches the filesystem.
        if not _is_uuid(card_id):
            raise ScryfallError("That isn't a Scryfall card id.")
        return self.cache_dir / "cards" / f"{card_id}.json"

    def _write_card(self, card: dict) -> None:
        self._card_path(card["id"]).write_text(json.dumps(card))


def _is_uuid(value: str) -> bool:
    parts = value.split("-")
    return [len(p) for p in parts] == [8, 4, 4, 4, 12] and all(
        c in "0123456789abcdef" for c in value.replace("-", "").lower()
    )
