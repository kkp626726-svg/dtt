#!/usr/bin/env python3
import argparse
import csv
import hashlib
from pathlib import Path

SUPPORTED = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".mp4", ".mov", ".webm", ".html", ".md", ".txt", ".csv"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Inventory local product-analysis evidence without reading sensitive metadata.")
    parser.add_argument("roots", nargs="+", help="Files or directories to inventory")
    parser.add_argument("--output", default="evidence-registry.csv")
    args = parser.parse_args()

    files = []
    for raw_root in args.roots:
        root = Path(raw_root).expanduser().resolve()
        candidates = [root] if root.is_file() else root.rglob("*")
        files.extend(path for path in candidates if path.is_file() and path.suffix.lower() in SUPPORTED)

    unique_files = sorted(set(files), key=lambda path: str(path).lower())
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(["evidence_id", "sequence", "source_type", "source_location", "file_name", "size_bytes", "sha256", "evidence_level", "notes"])
        for index, path in enumerate(unique_files, 1):
            writer.writerow([f"E{index:03d}", index, path.suffix.lower().lstrip("."), str(path), path.name, path.stat().st_size, sha256(path), "Unknown", ""])
    print(f"Wrote {len(unique_files)} evidence records to {output}")


if __name__ == "__main__":
    main()
