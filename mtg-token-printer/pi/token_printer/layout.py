"""Draws a token as a black-and-white label image.

The B1 prints 1-bit, so everything here ends up pure black or white: text and
boxes are drawn solid, and the art is dithered. The default size is the
50x80 mm preset (640 px across the print head, 1024 px along the feed).
"""

from __future__ import annotations

from PIL import Image, ImageDraw, ImageFont, ImageOps

WIDTH, HEIGHT = 640, 1024
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_CREDIT = FONT

BLACK, WHITE = 0, 255


def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def _text_width(draw: ImageDraw.ImageDraw, text: str, font) -> float:
    return draw.textlength(text, font=font)


def _fit_line(draw, text: str, path: str, max_width: int, start: int, smallest: int):
    """The largest font (down to `smallest`) that fits `text` on one line."""
    size = start
    font = _font(path, size)
    while size > smallest and _text_width(draw, text, font) > max_width:
        size -= 2
        font = _font(path, size)
    return font


def _wrap(draw, text: str, font, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        line = words[0]
        for word in words[1:]:
            trial = f"{line} {word}"
            if _text_width(draw, trial, font) <= max_width:
                line = trial
            else:
                lines.append(line)
                line = word
        lines.append(line)
    return lines


def _fit_paragraphs(draw, text: str, max_width: int, max_height: int, largest: int = 34):
    """Wrap rules text at the largest size (down to 16 px) that fits the box."""
    for size in range(largest, 15, -2):
        font = _font(FONT, size)
        lines = _wrap(draw, text, font, max_width)
        line_height = int(size * 1.25)
        if len(lines) * line_height <= max_height:
            return font, lines, line_height
    return font, lines[: max_height // line_height], line_height


def _dither(art: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Crop the art to fill `size`, boost contrast, and dither to 1-bit."""
    art = ImageOps.fit(art.convert("L"), size, method=Image.LANCZOS)
    art = ImageOps.autocontrast(art, cutoff=2)
    return art.convert("1").convert("L")  # Floyd-Steinberg by default


def render_token(
    token: dict,
    art: Image.Image | None = None,
    size: tuple[int, int] = (WIDTH, HEIGHT),
    margin: int = 20,
    x_shift: int = 0,
) -> Image.Image:
    """Render a token dict (name, type_line, text, power, toughness, artist).

    `margin` and `x_shift` match the label server's own settings, so a token
    sits on the label the same way its other labels do.
    """
    width, height = size
    img = Image.new("L", size, WHITE)
    draw = ImageDraw.Draw(img)

    left = margin + x_shift
    right = width - margin + x_shift
    top, bottom = margin, height - margin
    inner = right - left - 32  # text width inside the frame

    draw.rounded_rectangle((left, top, right, bottom), radius=24, outline=BLACK, width=4)

    # Name, centred, shrunk to fit one line.
    name = token.get("name") or "Token"
    font = _fit_line(draw, name, FONT_BOLD, inner, 56, 26)
    y = top + 20
    draw.text(((left + right) / 2, y), name, font=font, fill=BLACK, anchor="mt")
    y += font.size + 20

    # Art, if there is any. Without art the rules text gets the room.
    pt = _pt(token)
    footer = 104 if pt else 56
    if art is not None:
        art_h = int((bottom - top) * 0.44)
        box = (left + 16, y, right - 16, y + art_h)
        img.paste(_dither(art, (box[2] - box[0], box[3] - box[1])), box[:2])
        draw.rectangle(box, outline=BLACK, width=3)
        y = box[3] + 16

    # Type line on a black bar.
    type_line = token.get("type_line") or "Token"
    font = _fit_line(draw, type_line, FONT_BOLD, inner - 8, 30, 18)
    bar_h = font.size + 20
    draw.rounded_rectangle((left + 16, y, right - 16, y + bar_h), radius=10, fill=BLACK)
    draw.text((left + 28, y + bar_h / 2), type_line, font=font, fill=WHITE, anchor="lm")
    y += bar_h + 18

    # Rules text fills what's left above the footer.
    text = (token.get("text") or "").strip()
    if text:
        largest = 34 if art is not None else 44
        font, lines, line_h = _fit_paragraphs(draw, text, inner, bottom - footer - y, largest)
        for line in lines:
            draw.text((left + 16, y), line, font=font, fill=BLACK)
            y += line_h

    # Footer: artist credit on the left, power/toughness box on the right.
    if token.get("artist"):
        credit = f"Illus. {token['artist']}"
        font = _fit_line(draw, credit, FONT_CREDIT, inner - (200 if pt else 0), 20, 14)
        draw.text((left + 16, bottom - 22), credit, font=font, fill=BLACK, anchor="ls")
    if pt:
        font = _fit_line(draw, pt, FONT_BOLD, 150, 60, 30)
        box_w = max(150, int(_text_width(draw, pt, font)) + 40)
        box = (right - 16 - box_w, bottom - 16 - 84, right - 16, bottom - 16)
        draw.rounded_rectangle(box, radius=14, fill=BLACK)
        draw.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), pt, font=font, fill=WHITE, anchor="mm")

    # Text is anti-aliased; snap it to black or white so the printer's own
    # threshold can't thin or thicken strokes.
    return img.point(lambda v: WHITE if v >= 128 else BLACK)


def _pt(token: dict) -> str | None:
    power, toughness = token.get("power"), token.get("toughness")
    if power in (None, "") or toughness in (None, ""):
        return None
    return f"{power}/{toughness}"
