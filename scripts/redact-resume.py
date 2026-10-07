#!/usr/bin/env python3
"""Strip personal contact details from the downloadable resume PDF.

The published resume is served at /downloads/tariq-singh-resume.pdf, so the
mobile number and full postal code on it would be public. Drawing boxes over
them would leave both strings extractable, so this removes the text-showing
operators themselves from the page content stream.

After this runs the header reads:  tariq@live.ca | Brampton, Canada

Usage:
    python3 scripts/redact-resume.py <source.pdf> <output.pdf> <phone>

<phone> is the number exactly as it appears on the resume, digit groups
separated by dashes (e.g. 555-123-4567). It can also come from the
RESUME_PHONE environment variable. It's passed in at run time so the number
itself never has to be written into this public repo.

Run it against the pristine resume export, not against an already-redacted
file, so the transform stays reproducible.
"""
import os
import sys

import pikepdf

# Everything from the start of the postal code to the end of the header run.
POSTAL_PREFIX = "a L"


def redact(src: str, out: str, phone: str) -> None:
    groups = [g for g in phone.split("-") if g]
    if len(groups) < 2:
        raise SystemExit("phone must be digit groups separated by dashes, e.g. 555-123-4567")
    first, last = groups[0], groups[-1]

    pdf = pikepdf.open(src)
    page = pdf.pages[0]
    ops = pikepdf.parse_content_stream(page)

    # --- phone number -------------------------------------------------
    # Drawn as separate runs: one Tj per digit group and per dash, then a TJ
    # array holding the last group and the "|" separator that followed it.
    start = next(i for i, (o, op) in enumerate(ops)
                 if str(op) == "Tj" and first in str(o))
    end = next(i for i, (o, op) in enumerate(ops)
               if i > start and str(op) == "TJ" and last in str(o))
    header = next(i for i, (o, op) in enumerate(ops)
                  if i > end and str(op) == "TJ" and "@" in str(o))

    drop = set(range(start, end + 1))
    # The Td before the email closed the gap after "|"; without the phone the
    # email should sit at the line origin instead.
    drop |= {i for i in range(end + 1, header) if str(ops[i][1]) == "Td"}

    kept = [entry for i, entry in enumerate(ops) if i not in drop]

    # --- postal code --------------------------------------------------
    # The rest of the header is one TJ array of kerned glyph runs; the postal
    # code begins inside the run that closes "Canada" ("a L").
    for idx, (operands, op) in enumerate(kept):
        if str(op) != "TJ" or "@" not in str(operands):
            continue
        items = list(operands[0])
        cut = next(i for i, it in enumerate(items)
                   if isinstance(it, pikepdf.String) and str(it) == POSTAL_PREFIX)
        trimmed = items[:cut] + [pikepdf.String(POSTAL_PREFIX.rstrip(" L"))]
        kept[idx] = ([pikepdf.Array(trimmed)], op)
        break

    page.Contents = pdf.make_stream(pikepdf.unparse_content_stream(kept))

    # Document metadata can carry contact details of its own.
    for key in list(pdf.docinfo.keys()):
        del pdf.docinfo[key]
    if "/Metadata" in pdf.Root:
        del pdf.Root["/Metadata"]

    pdf.save(out, linearize=True)
    print(f"redacted {src} -> {out}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    phone = sys.argv[3] if len(sys.argv) > 3 else os.environ.get("RESUME_PHONE", "")
    if not phone:
        raise SystemExit("pass the phone number as the third argument or set RESUME_PHONE")
    redact(sys.argv[1], sys.argv[2], phone)
