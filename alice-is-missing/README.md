# Alice is Missing — table assistant

A small LAN web app for running *Alice is Missing* (Renegade Game Studios) at the table, from a
Raspberry Pi. It keeps the 90-minute clock, plays the soundtrack on a shared screen, and buzzes
the right player's phone when their timed Clue card is due. You still need the physical game:
it holds none of the card text, only the structure — which interval is next and who reveals it.

- **Table screen** (`/table`) — a TV, tablet or laptop. Big countdown, the next clue, a join QR
  code before the game, and the soundtrack.
- **Player phones** (`/join`) — scan the QR code or tap an NFC tag to take a seat. The screen
  turns red and the phone vibrates when it's your clue's minute.
- **Facilitator** (`/facilitator`) — seats, characters, who holds which clue, private suspect and
  location draws, and start/pause/adjust controls.

Node 20+ built-ins only: no `npm install` and no build step. It runs happily on a Pi Zero 2 W.

## Run it

```bash
cd alice-is-missing
node server.js            # http://<pi-address>:8080
```

The server prints its LAN address on startup. Open `/table` on the shared screen and
`/facilitator` on your phone. Everyone else scans the table's QR code.

| Option | Default | |
| --- | --- | --- |
| `PORT` / `--port=` | `8080` | |
| `ALICE_PIN` | unset | Require a PIN for facilitator actions |
| `PUBLIC_URL` | LAN IP | Base for QR/NFC links, e.g. `http://alice.local:8080` |
| `ALICE_SPEED` / `--speed=` | `1` | Debug time scale — `npm run fast` plays 90 minutes in 90 seconds |

## The soundtrack

Put your copy of the game's soundtrack audio in `media/` (any of mp3, m4a, ogg, opus, wav, flac).
The first audio file there is used, and it's git-ignored. If your file has an intro before the
timer starts, set `audioOffsetSeconds` in `game.config.json`.

Neither the Pi 5 nor the Pi Zero 2 W has a headphone jack, so **the table-screen device plays
the audio**, not the Pi. Tap *Enable sound* once when the table screen opens — browsers won't
autoplay without it. The audio follows the clock: pausing, adjusting time or reloading the page
all put it back in the right place.

## Joining with QR codes and NFC tags

Every seat has its own link, `/join?seat=N`. Opening it claims that seat and remembers it on that
phone, so a reload or a lost connection puts the player straight back.

- **QR:** the table screen shows a join code until the game starts. `/qr` is a printable sheet
  with a card per seat — fold them into table tents.
- **NFC:** get NTAG213 or NTAG215 stickers or buttons and write each seat's link to one as a
  *URL* record. The facilitator page lists each link with a copy button. Use a free app such as
  NFC Tools (iOS/Android). Any modern phone opens the link when it touches the tag, with no app
  needed. On Android Chrome the facilitator page also shows a *Write NFC tag* button, but only
  over HTTPS or on `localhost` — browsers keep Web NFC off plain-HTTP pages.

If `alice.local` works on your network, set `PUBLIC_URL=http://alice.local:8080` before writing
tags. The tags then keep working if the Pi's IP address changes.

If someone switches phones, the facilitator taps *Release seat* and they join again.

## Put it on the Pi

Use 64-bit Raspberry Pi OS Lite on either board.

```bash
# Node 20+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Just this folder of the repo
git clone --filter=blob:none --sparse https://github.com/calsolum/portfolio.git Portfolio
cd Portfolio && git sparse-checkout set alice-is-missing
cd alice-is-missing
cp ~/soundtrack.mp3 media/

# Start on boot (edit User/WorkingDirectory in the unit if yours differ)
sudo cp deploy/alice.service /etc/systemd/system/
sudo systemctl enable --now alice
journalctl -u alice -f     # shows the address to open
```

Pi OS runs Avahi, so `http://<hostname>.local:8080` usually works. Set the hostname to `alice`
with `sudo raspi-config` to get `alice.local`.

## Notes

- Game state saves to `data/state.json`, so a crash or reboot resumes where you were. The clock
  runs on the Pi's wall time: a Pi Zero has no battery-backed clock, so let it reach the network
  (NTP) before you resume a saved game.
- `game.config.json` holds the clue intervals, seat limits and setup checklist. Check them
  against your rulebook and edit them freely, then restart the server.
- Screens try to stay awake using the Wake Lock API. Browsers only allow it over HTTPS, so on a
  plain LAN, set phones' auto-lock to *Never* for the session.
- QR codes are drawn by Kazuhiko Arase's MIT-licensed `qrcode-generator`, which is vendored in
  `public/vendor/`.
