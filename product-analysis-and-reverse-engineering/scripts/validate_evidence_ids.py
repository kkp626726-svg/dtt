#!/usr/bin/env python3
import argparse
import csv
import re
from pathlib import Path

PATTERN = re.compile(r"\bE\d{3,}\b")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate evidence IDs referenced by analysis files against a registry CSV.")
    parser.add_argument("registry")
    parser.add_argument("files", nargs="+")
    args = parser.parse_args()

    with Path(args.registry).open(encoding="utf-8-sig", newline="") as handle:
        known = {row["evidence_id"].strip() for row in csv.DictReader(handle) if row.get("evidence_id")}

    referenced = set()
    for raw_path in args.files:
        path = Path(raw_path)
        candidates = [path] if path.is_file() else path.rglob("*")
        for candidate in candidates:
            if candidate.is_file() and candidate.suffix.lower() in {".md", ".html", ".csv", ".txt", ".mmd"}:
                referenced.update(PATTERN.findall(candidate.read_text(encoding="utf-8", errors="ignore")))

    missing = sorted(referenced - known)
    unused = sorted(known - referenced)
    print(f"Known: {len(known)} | Referenced: {len(referenced)} | Missing: {len(missing)} | Unused: {len(unused)}")
    if missing:
        print("Missing IDs: " + ", ".join(missing))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
