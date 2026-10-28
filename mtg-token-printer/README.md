# MTG Token Printer

Print Magic: The Gathering tokens on a Bluetooth label printer from an Android phone.
Each token prints on one 50×80 mm label: name, dithered art, type line, rules text, a
big power/toughness box and the artist credit. You can also type in your own token.

This isn't part of the website. It lives here so the code sits with the rest of my projects.

```
android/   Kotlin + Jetpack Compose app (search, preview, copies, print, custom tokens)
pi/        Flask blueprint that plugs into the Kitchen Hub label server on the Raspberry Pi
```

## How it works

1. The app sends the label server a Scryfall token id (or a custom token) and a copy count.
2. The Pi looks the token up on [Scryfall](https://scryfall.com/docs/api), caches it, and
   draws the label in pure black and white at the preset's printable size (577×927 px for
   the 50×80 mm roll, calibrated from a test print).
3. The label server's existing job queue prints it over Bluetooth. The app polls the job
   and shows "Printed." or "Print failed: <reason>". Failed jobs aren't retried.

Everything is free: Scryfall's API needs no key, the APK is built by GitHub Actions and
installed directly (no Play Store), and the Pi was already running.

## Pi routes

| Route | Does |
| --- | --- |
| `GET /tokens/health` | Checks the server and whether the 50×80 mm size is selected |
| `GET /tokens/search?q=goblin` | Searches Scryfall tokens |
| `POST /preview/token` | Returns the label as a PNG. Body: `{"id": "<scryfall id>"}` or `{"custom": {...}}` |
| `POST /print/token` | Queues a print. Body adds `"copies": 1-10`. Returns `{"job": "..."}` |
| `GET /print/token/<job>` | `{"state": "queued" \| "printing" \| "done" \| "failed", "error": ...}` |

Errors come back as `{"error": "<message for the user>"}`.

### Installing on the Pi

1. Copy `pi/token_printer/` next to `label_server.py`, and `pip install requests` if it's missing.
2. Back up `label_server.py`, then add the hookup from `pi/kitchen_hub_hookup.py`, filling in
   the three small adapter functions from the server's own job queue.
3. Restart the label service.

To undo it, remove those lines and restart again. Nothing else on the Pi changes.

### Tests

```bash
cd pi
pip install -r requirements.txt pytest
python -m pytest -q
```

## Android app

GitHub Actions builds the APK on every change in this folder
(`.github/workflows/token-printer.yml`). Changes on the `portfolio` branch also refresh
the **Token Printer (latest)** release, so the phone always downloads from the same link.

1. On the phone, open the release and download `token-printer.apk`.
2. Allow installs from the browser when Android asks, then install.
3. Open Token Printer, enter the label server's address with its port, tap **Test**, then **Save**.

`android/app/debug.keystore` signs the APK with a fixed key, so each new build installs
over the last one. It's a debug key for this sideloaded app only.

To build it yourself, open `android/` in Android Studio, or run `./gradlew assembleDebug`.
