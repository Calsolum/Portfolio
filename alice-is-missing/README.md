# Alice is Missing — table assistant

A small LAN web app for running *Alice is Missing* (Renegade Game Studios) at the table, from a
Raspberry Pi. It keeps the 90-minute clock, plays the soundtrack on a shared screen, buzzes
the right player's phone when their timed Clue card is due, and has a built-in messenger, so
nobody has to swap real phone numbers to play. You still need the physical game:
it holds none of the card text, only the structure — which interval is next and who reveals it.

- **Table screen** (`/table`) — a TV, tablet or laptop. Big countdown, the next clue, a join QR
  code before the game, and the soundtrack.
- **Player phones** (`/join`) — scan the QR code or tap an NFC tag to take a seat. Text as your
  character in the group chat or privately. A *Right now* card says what you should be doing,
  and the Rules tab holds the rulebook and table notes. The screen turns red and the phone
  vibrates when it's your clue's minute.
- **Facilitator** (`/facilitator`) — seats, characters, who holds which clue, private suspect and
  location draws, start/pause/adjust controls, and texting players as NPCs.
- **Transcript** (`/transcript`) — every message, in order, once the game is over.

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

## Right now, and the rules

**Right now.** Each phone's Game tab has a short list of what that player should be doing,
worked out from the game state. It asks for your character during setup and says when you're
waiting for the start or the game is paused. It shows your next clue and how long until it's
due, and it flags a clue that's due now. It lists unread messages (tap to jump to the
conversation), then links the transcript at the end. The most urgent item also sits above the
conversation list. The facilitator can post a one-line **announcement**, like "five-minute
break", that tops every phone and shows on the table screen.

**Rules.** The rulebook isn't a free download (it's sold as the book and a PDF at
[aliceismissing.com](https://www.aliceismissing.com/)), so none of it ships in this repo. To
make your own copy available at the table, put it in `media/rules/` on the Pi: a PDF, photos of
the pages (jpg/png/webp), or a text file. Every phone's Rules tab lists them, served from the Pi
over your network only. Prefix filenames with numbers to set the order
(`1-core-rules.pdf`, `2-quick-reference.jpg`); dashes and underscores become spaces. The
facilitator can also type **table notes** (house rules, or a quick reference in your own
words), which update live on every phone. There are links to the official site too, for when
the table has internet.

## Messaging

Every seat texts as its character. There's one group chat and a private thread between each
pair of characters, with unread badges, typing indicators, and the game clock on each message.

- **NPCs:** the facilitator can add senders like "Unknown number" and text any player, or the
  group, as them. Players can reply, and the replies show up in the facilitator's console.
- **Privacy:** while the game runs, a private chat is visible only to the two people in it. The
  facilitator sees the group chat and NPC threads, never the private chats between players.
  When the clock hits zero, everything unlocks. Anyone can open `/transcript` to read the whole
  story, print it, or download it as JSON.
- **Storage:** messages are saved to `data/messages.json` on the Pi and never leave your
  network. Everything works without internet. *Clear messages* on the facilitator page, or
  *New game*, wipes them.
- **Keep the page open:** phones (iOS especially) pause background browser tabs. A phone that
  was locked catches up on everything it missed the moment its page is visible again, but it
  can't buzz while it's in the background.

Pages trust the local network: anyone who can reach the Pi can open the facilitator page unless
you set `ALICE_PIN`. Set it if you want NPC texting and the private draws locked down.

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
