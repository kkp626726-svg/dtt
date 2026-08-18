#!/usr/bin/env python3
import argparse
import hashlib
import json
import zipfile
from pathlib import Path


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Package product-analysis deliverables with a checksum manifest.")
    parser.add_argument("source")
    parser.add_argument("output")
    args = parser.parse_args()

    source = Path(args.source).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    files = sorted(path for path in source.rglob("*") if path.is_file() and not any(part.startswith(".") for part in path.relative_to(source).parts))
    manifest = [{"path": path.relative_to(source).as_posix(), "size": path.stat().st_size, "sha256": checksum(path)} for path in files]
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(source.parent).as_posix())
        archive.writestr(f"{source.name}/manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"Packaged {len(files)} files into {output}")


if __name__ == "__main__":
    main()
