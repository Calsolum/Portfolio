#!/usr/bin/env python3
"""One-time importer: WordPress export -> HTML content fragments in src/content/.

The export at `calsolum-wordpress-import.xml` holds the full text of every work
(fiction, poetry, scripts, project write-ups). Its markup is already a small,
clean subset -- em, strong, h2, hr, ul/li, a -- with paragraphs separated by
blank lines, so the only transform needed is wrapping bare text blocks in <p>.

This is a one-time import. The files it writes to src/content/ have since been
edited by hand, so re-running it will overwrite those edits -- diff before
committing if you ever do.

Usage: python3 scripts/extract-wordpress-content.py <path-to-export.xml>
"""
import html
import json
import pathlib
import re
import sys

SLUGS = {
    "About": "about",
    "Games": "games",
    "Mansion of Fate": "mansion-of-fate",
    "Choices": "choices",
    "Poetry": "poetry",
    "Seasons of Everything": "seasons-of-everything",
    "Fiction": "fiction",
    "The Infinite Cycle": "the-infinite-cycle",
    "Veritas Case Files: Forest of the Dead": "veritas-case-files",
    "Scripts": "scripts",
    "The Tongue-Cut Sparrow": "the-tongue-cut-sparrow",
    "Overlooked": "overlooked",
    "Projects": "projects",
    "Kitchen Hub": "kitchen-hub",
    "DrunkQuest": "drunkquest",
    "Tragedy Looper Player Aid": "tragedy-looper",
}

# Block-level elements that must never be nested inside a generated <p>.
BLOCK_RE = re.compile(
    r"(<(?:ul|ol|blockquote|figure|table)\b.*?</(?:ul|ol|blockquote|figure|table)>"
    r"|<h[1-6]\b.*?</h[1-6]>"
    r"|<hr\s*/?>)",
    re.I | re.S,
)


def wrap_text(chunk: str) -> str:
    """Wrap a run of plain text in <p>, keeping single newlines as soft breaks.

    Poetry and script formatting depend on those line breaks, so they become
    <br /> rather than collapsing into flowing prose.
    """
    chunk = chunk.strip()
    if not chunk:
        return ""
    return "<p>" + chunk.replace("\n", "<br />\n") + "</p>"


def to_html(raw: str) -> str:
    """Give WordPress' implicit paragraphs real <p> tags.

    The export separates paragraphs with blank lines and leaves block elements
    (lists, headings, rules) inline, so each blank-line block is split on those
    block elements first and only the remaining text runs are wrapped.
    """
    out = []
    for block in re.split(r"\n\s*\n", raw.strip()):
        if not block.strip():
            continue
        for segment in BLOCK_RE.split(block):
            if not segment.strip():
                continue
            if BLOCK_RE.fullmatch(segment.strip()):
                # Strip the stray <br /> WordPress leaves between <li> items.
                out.append(re.sub(r"<br\s*/?>\s*", "", segment.strip()))
            else:
                wrapped = wrap_text(segment)
                if wrapped:
                    out.append(wrapped)
    return "\n\n".join(out) + "\n"


def text_length(fragment: str) -> int:
    plain = re.sub(r"<[^>]+>", " ", fragment)
    return len(re.sub(r"\s+", " ", html.unescape(plain)).strip())


def main() -> None:
    src = pathlib.Path(sys.argv[1])
    dest = pathlib.Path(__file__).resolve().parent.parent / "src" / "content"
    dest.mkdir(parents=True, exist_ok=True)

    xml = src.read_text(encoding="utf8", errors="ignore")
    report = []

    for item in re.findall(r"<item>(.*?)</item>", xml, re.S):
        title = html.unescape(re.search(r"<title>(.*?)</title>", item, re.S).group(1).strip())
        body = re.search(
            r"<content:encoded><!\[CDATA\[(.*?)\]\]></content:encoded>", item, re.S
        )
        if not body or title not in SLUGS:
            print(f"  skipped: {title}")
            continue
        fragment = to_html(body.group(1))
        (dest / f"{SLUGS[title]}.html").write_text(fragment, encoding="utf8")
        report.append(
            {"title": title, "slug": SLUGS[title], "chars": text_length(fragment)}
        )

    print(json.dumps(report, indent=2))
    print(f"\nwrote {len(report)} files to {dest}")


if __name__ == "__main__":
    main()
