"""Selecting parts of a collection and rendering them as BBCode."""

from __future__ import annotations

import re
from typing import Iterable, Sequence

from .api import Comparison, SlowPicsError

_RANGE_RE = re.compile(r"(\d+)\s*-\s*(\d+)")


def _parse_indices(selector: str, count: int, what: str) -> list[int] | None:
    """Turn ``"3"`` or ``"2-5"`` (1-based, inclusive) into 0-based indices, or None if not numeric."""
    selector = selector.strip()
    if selector.isdigit():
        start = end = int(selector)
    else:
        match = _RANGE_RE.fullmatch(selector)
        if not match:
            return None
        start, end = int(match.group(1)), int(match.group(2))
    if start > end:
        start, end = end, start
    if start < 1 or end > count:
        raise SlowPicsError(f"{what} {selector!r} is out of range (there are {count})")
    return list(range(start - 1, end))


def select_comparisons(comparisons: Sequence[Comparison], selectors: Iterable[str]) -> list[Comparison]:
    """Pick comparisons by exact name (case-insensitive), 1-based number, or number range like ``2-5``.

    Names win over numbers, so a comparison literally named ``"2"`` is chosen over the second one.
    """
    selected: list[Comparison] = []
    for selector in selectors:
        by_name = [comp for comp in comparisons if comp.name.casefold() == selector.strip().casefold()]
        if by_name:
            selected.extend(by_name)
            continue
        indices = _parse_indices(selector, len(comparisons), "Comparison")
        if indices is None:
            raise SlowPicsError(f"No comparison named {selector!r}")
        selected.extend(comparisons[i] for i in indices)
    return selected


def select_sources(comparisons: Sequence[Comparison], selectors: Sequence[str]) -> list[Comparison]:
    """Keep only the chosen images (sources) of every comparison, in the order given.

    Sources are picked by image name (case-insensitive) or by 1-based position within a comparison.
    """
    filtered = []
    for comp in comparisons:
        images = []
        for selector in selectors:
            by_name = [img for img in comp.images if img.name.casefold() == selector.strip().casefold()]
            if by_name:
                images.extend(by_name)
                continue
            indices = _parse_indices(selector, len(comp.images), "Source")
            if indices is None:
                raise SlowPicsError(f"No source named {selector!r} in comparison {comp.name!r}")
            images.extend(comp.images[i] for i in indices)
        filtered.append(Comparison(name=comp.name, images=tuple(images)))
    return filtered


def default_labels(comparisons: Sequence[Comparison]) -> list[str]:
    """Source names for the ``[comparison=...]`` header, taken from the first comparison."""
    if not comparisons:
        return []
    return [img.name.strip() or f"Image {n}" for n, img in enumerate(comparisons[0].images, 1)]


def comparison_bbcode(comparisons: Sequence[Comparison], labels: Sequence[str] | None = None) -> str:
    """Render comparisons as a ``[comparison=...]`` block with one comparison (frame) per line."""
    if labels is None:
        labels = default_labels(comparisons)
    lines = [f"[comparison={', '.join(labels)}]"]
    lines.extend(", ".join(img.url for img in comp.images) for comp in comparisons)
    lines.append("[/comparison]")
    return "\n".join(lines)


def img_bbcode(comparisons: Sequence[Comparison]) -> str:
    """Render every image as its own ``[img]`` tag, one per line."""
    return "\n".join(f"[img]{img.url}[/img]" for comp in comparisons for img in comp.images)
