#!/usr/bin/env python3
import argparse
import html
from pathlib import Path

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a self-contained local HTML gallery for organized evidence images.")
    parser.add_argument("root")
    parser.add_argument("--output", default="index.html")
    parser.add_argument("--title", default="Product Evidence Gallery")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    output = Path(args.output)
    if not output.is_absolute():
        output = root / output
    images = sorted((path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS), key=lambda path: str(path.relative_to(root)).lower())

    cards = []
    for path in images:
        relative = path.relative_to(output.parent).as_posix()
        label = path.stem.replace("_", " ")
        scene = path.parent.name.replace("_", " ")
        cards.append(f'<article><img loading="lazy" src="{html.escape(relative)}" alt="{html.escape(label)}"><div><b>{html.escape(label)}</b><small>{html.escape(scene)}</small></div></article>')

    document = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(args.title)}</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#0b0d12;color:#f5f7fb;font:14px/1.5 system-ui,-apple-system,"PingFang SC",sans-serif}}header{{position:sticky;top:0;padding:20px 4vw;background:#0b0d12e8;backdrop-filter:blur(14px);border-bottom:1px solid #292e3a;z-index:2}}h1{{margin:0;font-size:26px}}p{{margin:4px 0 0;color:#9ba4b5}}main{{width:min(1500px,94vw);margin:24px auto 70px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));gap:16px}}article{{overflow:hidden;border:1px solid #292e3a;border-radius:16px;background:#151821}}img{{display:block;width:100%;aspect-ratio:1.92/1;object-fit:cover;background:#000}}article div{{padding:12px 14px 15px}}b,small{{display:block}}small{{color:#9ba4b5;margin-top:3px}}</style></head><body><header><h1>{html.escape(args.title)}</h1><p>{len(images)} images · sorted by scene and sequence</p></header><main>{''.join(cards)}</main></body></html>'''
    output.write_text(document, encoding="utf-8")
    print(f"Wrote {len(images)} image cards to {output}")


if __name__ == "__main__":
    main()
