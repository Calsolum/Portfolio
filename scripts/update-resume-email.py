#!/usr/bin/env python3
"""Swap the visible email domain on the resume PDF's header line.

The resume is a static binary, authored outside this repo and only ever
touched via targeted content-stream edits (see redact-resume.py for the
phone/postal removal this builds on). It does not regenerate from
src/data/site.ts, so profile.email changes there don't reach it -- this
script is how the two get kept in sync.

Usage:
    python3 scripts/update-resume-email.py <source.pdf> <output.pdf>
"""
import sys

import pikepdf

OLD_LOCAL = "live"  # the part of "tariq@live.ca" being replaced
NEW_LOCAL = "tariqsingh"  # -> "tariq@tariqsingh.ca"


def swap(src: str, out: str) -> None:
    pdf = pikepdf.open(src)
    page = pdf.pages[0]
    ops = pikepdf.parse_content_stream(page)

    for idx, (operands, op) in enumerate(ops):
        if str(op) != "TJ" or "@" not in str(operands):
            continue
        items = list(operands[0])
        start = next(i for i, it in enumerate(items)
                     if isinstance(it, pikepdf.String) and str(it) == OLD_LOCAL[0])
        end = next(i for i, it in enumerate(items)
                    if isinstance(it, pikepdf.String) and str(it) == OLD_LOCAL[-1])

        # Reuses this line's own kerning style (small negative adjustments
        # that add letter-spacing) rather than the font's default advances.
        replacement = []
        for ch in NEW_LOCAL:
            replacement.append(pikepdf.String(ch))
            replacement.append(-16)
        new_items = items[:start] + replacement + items[end + 1:]
        ops[idx] = ([pikepdf.Array(new_items)], op)
        break
    else:
        raise SystemExit(f"could not find {OLD_LOCAL!r} in the header line")

    page.Contents = pdf.make_stream(pikepdf.unparse_content_stream(ops))
    pdf.save(out, linearize=True)
    print(f"{src} -> {out}: {OLD_LOCAL} -> {NEW_LOCAL}")


if __name__ == "__main__":
    swap(sys.argv[1], sys.argv[2])
