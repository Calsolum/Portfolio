import io

import pytest
from flask import Flask
from PIL import Image

from token_printer import create_blueprint, render_token
from token_printer.routes import normalize_status
from token_printer.scryfall import Scryfall, ScryfallError, summarize

GOBLIN_ID = "0f8bd0c1-8f9a-4b52-9e2d-7c1f2a3b4c5d"

GOBLIN = {
    "id": GOBLIN_ID,
    "name": "Goblin",
    "type_line": "Token Creature — Goblin",
    "oracle_text": "",
    "power": "1",
    "toughness": "1",
    "colors": ["R"],
    "artist": "Kev Walker",
    "set_name": "Murders at Karlov Manor Tokens",
    "image_uris": {"art_crop": "https://cards.scryfall.io/art_crop/goblin.jpg",
                   "small": "https://cards.scryfall.io/small/goblin.jpg"},
}

DOUBLE_FACED = {
    "id": "1a2b3c4d-1111-2222-3333-444455556666",
    "name": "Incubator // Phyrexian",
    "type_line": "Token Artifact // Token Artifact Creature — Phyrexian",
    "card_faces": [
        {"name": "Incubator", "type_line": "Token Artifact",
         "oracle_text": "{2}: Transform this artifact.", "artist": "Ryan Pancoast",
         "image_uris": {"art_crop": "https://cards.scryfall.io/art_crop/inc.jpg"}},
        {"name": "Phyrexian", "type_line": "Token Artifact Creature — Phyrexian",
         "power": "0", "toughness": "0"},
    ],
}


def art():
    img = Image.new("RGB", (626, 457))
    for x in range(626):
        for y in range(0, 457, 8):
            img.putpixel((x, y), (x % 256, y % 256, 128))
    return img


class FakeScryfall:
    def __init__(self):
        self.cards = {GOBLIN_ID: summarize(GOBLIN)}

    def search(self, q):
        return [c for c in self.cards.values() if q.lower() in c["name"].lower()]

    def card(self, card_id):
        if card_id not in self.cards:
            raise ScryfallError("That token isn't on Scryfall.")
        return self.cards[card_id]

    def art(self, url):
        return art() if url else None


@pytest.fixture
def printer():
    jobs = {}

    def submit(image, copies):
        job = f"job{len(jobs) + 1}"
        jobs[job] = {"image": image, "copies": copies, "state": "running"}
        return job

    return jobs, submit


@pytest.fixture
def client(printer, tmp_path):
    jobs, submit = printer
    app = Flask(__name__)
    app.register_blueprint(create_blueprint(
        submit=submit, status=jobs.get, cache_dir=tmp_path, scryfall=FakeScryfall()))
    return app.test_client()


def is_one_bit(img):
    hist = img.histogram()
    return sum(hist) == hist[0] + hist[255]


def test_summarize_reads_top_level_card():
    card = summarize(GOBLIN)
    assert card["name"] == "Goblin"
    assert (card["power"], card["toughness"]) == ("1", "1")
    assert card["art_url"].endswith("goblin.jpg")


def test_summarize_takes_front_face_of_double_faced_token():
    card = summarize(DOUBLE_FACED)
    assert card["name"] == "Incubator"
    assert card["type_line"] == "Token Artifact"
    assert card["text"].startswith("{2}")
    assert card["artist"] == "Ryan Pancoast"
    assert card["art_url"].endswith("inc.jpg")


def test_render_is_label_sized_and_pure_black_and_white():
    img = render_token(summarize(GOBLIN), art())
    assert img.size == (640, 1024)
    assert img.mode == "L"
    assert is_one_bit(img)


def test_render_fits_very_long_rules_text():
    token = {"name": "A Token With An Extremely Long Name For Testing",
             "type_line": "Token Legendary Artifact Creature — Construct Wizard",
             "text": "Flying, vigilance, deathtouch. " * 30, "power": "*", "toughness": "*"}
    img = render_token(token, art())
    assert img.size == (640, 1024)
    assert is_one_bit(img)


def test_render_custom_token_without_art_or_pt():
    img = render_token({"name": "Treasure", "type_line": "Token Artifact — Treasure",
                        "text": "{T}, Sacrifice this artifact: Add one mana of any color."})
    assert is_one_bit(img)


def test_search(client):
    resp = client.get("/tokens/search?q=gob")
    assert resp.status_code == 200
    assert resp.json["results"][0]["name"] == "Goblin"


def test_preview_returns_png(client):
    resp = client.post("/preview/token", json={"id": GOBLIN_ID})
    assert resp.status_code == 200
    assert resp.mimetype == "image/png"
    assert Image.open(io.BytesIO(resp.data)).size == (640, 1024)


def test_print_queues_job_with_copies(client, printer):
    jobs, _ = printer
    resp = client.post("/print/token", json={"id": GOBLIN_ID, "copies": 3})
    assert resp.status_code == 202
    job = resp.json["job"]
    assert jobs[job]["copies"] == 3
    assert client.get(f"/print/token/{job}").json == {"state": "printing", "error": None}


def test_print_custom_token(client, printer):
    jobs, _ = printer
    resp = client.post("/print/token", json={"custom": {"name": "Zombie", "type_line": "Token Creature — Zombie",
                                                        "power": "2", "toughness": "2"}})
    assert resp.status_code == 202
    assert jobs[resp.json["job"]]["image"].size == (640, 1024)


@pytest.mark.parametrize("body,message", [
    ({}, "Pick a token first."),
    ({"id": GOBLIN_ID, "copies": 0}, "Print between 1 and 10 copies."),
    ({"id": GOBLIN_ID, "copies": "lots"}, "Copies must be a number."),
    ({"custom": {"name": " "}}, "Give the token a name."),
])
def test_print_rejects_bad_requests(client, body, message):
    resp = client.post("/print/token", json=body)
    assert resp.status_code == 400
    assert resp.json["error"] == message


def test_unknown_token_is_a_clear_failure(client):
    resp = client.post("/print/token", json={"id": "00000000-0000-0000-0000-000000000000"})
    assert resp.status_code == 502
    assert "isn't on Scryfall" in resp.json["error"]


def test_wrong_label_size_is_refused(tmp_path):
    app = Flask(__name__)
    app.register_blueprint(create_blueprint(
        submit=lambda i, c: "x", status=lambda j: None, label_size=lambda: (640, 394),
        cache_dir=tmp_path, scryfall=FakeScryfall()))
    resp = app.test_client().post("/print/token", json={"id": GOBLIN_ID})
    assert resp.status_code == 400
    assert "50×80" in resp.json["error"]
    assert app.test_client().get("/tokens/health").json["ready"] is False


def test_token_size_follows_the_calibrated_preset(tmp_path):
    jobs = {}
    app = Flask(__name__)
    app.register_blueprint(create_blueprint(
        submit=lambda image, copies: jobs.setdefault("j", image) and "j", status=lambda j: None,
        label_size=lambda: (577, 927), token_size=(577, 927),
        cache_dir=tmp_path, scryfall=FakeScryfall()))
    client = app.test_client()
    assert client.get("/tokens/health").json["ready"] is True
    assert client.post("/print/token", json={"id": GOBLIN_ID}).status_code == 202
    assert jobs["j"].size == (577, 927)
    assert is_one_bit(jobs["j"])


def test_queue_failure_says_it_failed(tmp_path):
    def broken(image, copies):
        raise RuntimeError("printer not connected")

    app = Flask(__name__)
    app.register_blueprint(create_blueprint(
        submit=broken, status=lambda j: None, cache_dir=tmp_path, scryfall=FakeScryfall()))
    resp = app.test_client().post("/print/token", json={"id": GOBLIN_ID})
    assert resp.status_code == 503
    assert resp.json["error"] == "Print failed: printer not connected"


@pytest.mark.parametrize("raw,state", [
    (None, "failed"),
    ({"state": "queued"}, "queued"),
    ({"status": "running"}, "printing"),
    ({"status": "complete"}, "done"),
    ({"state": "error", "error": "Out of labels"}, "failed"),
    ({"state": "something-new"}, "printing"),
])
def test_normalize_status(raw, state):
    assert normalize_status(raw)["state"] == state


def test_failed_status_keeps_reason():
    assert normalize_status({"state": "error", "error": "Out of labels"})["error"] == "Out of labels"


def test_card_ids_must_be_uuids(tmp_path):
    with pytest.raises(ScryfallError):
        Scryfall(tmp_path).card("../../etc/passwd")
