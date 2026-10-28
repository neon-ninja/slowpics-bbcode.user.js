"""The ``slowpics`` command-line interface."""

from __future__ import annotations

import argparse
import sys
from typing import Sequence

from . import __version__
from .api import Collection, SlowPicsError, get_collection
from .bbcode import comparison_bbcode, img_bbcode, select_comparisons, select_sources

COLLECTION_HELP = "slow.pics collection URL (e.g. https://slow.pics/c/xnkAHiN5) or just its key (xnkAHiN5)"


def _describe(collection: Collection) -> str:
    total_images = sum(len(comp.images) for comp in collection.comparisons)
    if collection.is_comparison:
        sources = max(len(comp.images) for comp in collection.comparisons)
        return f"comparison: {len(collection.comparisons)} comparisons, {sources} sources, {total_images} images"
    return f"collection: {total_images} images"


def cmd_list(args: argparse.Namespace) -> int:
    collection = get_collection(args.collection, timeout=args.timeout)
    print(collection.name or "(untitled)")
    print(f"{collection.url} ({_describe(collection)})")
    for n, comp in enumerate(collection.comparisons, 1):
        print()
        print(f"[{n}] {comp.name or '(unnamed)'}")
        width = max((len(img.name) for img in comp.images), default=0)
        for m, img in enumerate(comp.images, 1):
            print(f"    {m}. {img.name:<{width}}  {img.url}")
    return 0


def cmd_bbcode(args: argparse.Namespace) -> int:
    collection = get_collection(args.collection, timeout=args.timeout)
    comparisons = list(collection.comparisons)
    if args.comparison:
        comparisons = select_comparisons(comparisons, args.comparison)
    if args.source:
        comparisons = select_sources(comparisons, args.source)

    fmt = args.format
    if fmt == "auto":
        fmt = "comparison" if collection.is_comparison else "img"

    if fmt == "comparison":
        labels = [label.strip() for label in args.labels.split(",")] if args.labels else None
        print(comparison_bbcode(comparisons, labels))
    else:
        print(img_bbcode(comparisons))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="slowpics",
        description="Work with slow.pics collections: list their comparisons and export them as BBCode.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument(
        "--timeout", type=float, default=30.0, metavar="SECONDS", help="network timeout (default: %(default)s)"
    )
    subparsers = parser.add_subparsers(dest="command", required=True, metavar="COMMAND")

    list_parser = subparsers.add_parser(
        "list",
        help="list the comparisons in a collection and the images in each",
        description="List the comparisons in a collection, numbered, with each image's name and URL. "
        "The numbers can be passed to 'slowpics bbcode' with --comparison and --source.",
    )
    list_parser.add_argument("collection", help=COLLECTION_HELP)
    list_parser.set_defaults(func=cmd_list)

    bbcode_parser = subparsers.add_parser(
        "bbcode",
        help="print a collection as BBCode",
        description="Print a collection as BBCode. Comparisons become a [comparison=...] block with one "
        "comparison per line; plain image collections become one [img] tag per image.",
    )
    bbcode_parser.add_argument("collection", help=COLLECTION_HELP)
    bbcode_parser.add_argument(
        "-c",
        "--comparison",
        action="append",
        metavar="SELECTOR",
        help="only include this comparison: its name, its number from 'slowpics list', or a range such as "
        "2-5 (repeatable; default: all comparisons)",
    )
    bbcode_parser.add_argument(
        "-s",
        "--source",
        action="append",
        metavar="SELECTOR",
        help="only include this source (image) from each comparison, by name or number; repeat to pick "
        "several, in the order they should appear (default: all sources)",
    )
    bbcode_parser.add_argument(
        "-f",
        "--format",
        choices=("auto", "comparison", "img"),
        default="auto",
        help="BBCode style: [comparison=...] block or one [img] tag per image (default: %(default)s, "
        "which picks based on how the collection was uploaded)",
    )
    bbcode_parser.add_argument(
        "-l",
        "--labels",
        metavar="NAMES",
        help="comma-separated names for the [comparison=...] header, e.g. 'Source, Encode' "
        "(default: the image names from the first comparison)",
    )
    bbcode_parser.set_defaults(func=cmd_bbcode)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except SlowPicsError as exc:
        print(f"slowpics: error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
