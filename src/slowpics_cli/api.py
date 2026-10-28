"""Fetching and parsing slow.pics collections."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from . import __version__

SITE_URL = "https://slow.pics"
IMAGE_URL = "https://i.slow.pics"
API_URL = f"{SITE_URL}/api/comparison"

# slow.pics asks API clients to identify themselves with a descriptive User-Agent.
USER_AGENT = f"slowpics-cli/{__version__} (+https://github.com/neon-ninja/slow.pics.CLI)"

_KEY_RE = re.compile(r"[A-Za-z0-9]+")
_URL_RE = re.compile(
    r"^(?:https?://)?(?:www\.)?slow\.pics/(?:c|api/comparison)/([A-Za-z0-9]+)(?:[/?#].*)?$",
    re.IGNORECASE,
)


class SlowPicsError(Exception):
    """Raised when a collection can't be resolved, fetched or understood."""


@dataclass(frozen=True)
class Image:
    name: str
    url: str


@dataclass(frozen=True)
class Comparison:
    name: str
    images: tuple[Image, ...]


@dataclass(frozen=True)
class Collection:
    key: str
    name: str
    comparisons: tuple[Comparison, ...]

    @property
    def url(self) -> str:
        return f"{SITE_URL}/c/{self.key}"

    @property
    def is_comparison(self) -> bool:
        """Best guess at whether this was uploaded as a comparison rather than a plain collection.

        A plain image collection is stored as a single unnamed group holding every image, while a
        comparison has one (named) group per frame, each holding one image per source.
        """
        if not self.comparisons:
            return False
        if len(self.comparisons) == 1 and not self.comparisons[0].name.strip():
            return False
        return any(len(comp.images) > 1 for comp in self.comparisons)


def parse_key(value: str) -> str:
    """Extract the collection key from a slow.pics URL or a bare key.

    >>> parse_key("https://slow.pics/c/xnkAHiN5")
    'xnkAHiN5'
    >>> parse_key("xnkAHiN5")
    'xnkAHiN5'
    """
    value = value.strip()
    if _KEY_RE.fullmatch(value):
        return value
    match = _URL_RE.match(value)
    if match:
        return match.group(1)
    raise SlowPicsError(
        f"Not a slow.pics collection URL or key: {value!r} "
        "(expected e.g. https://slow.pics/c/xnkAHiN5 or xnkAHiN5)"
    )


def fetch_collection_json(key: str, timeout: float = 30.0) -> dict[str, Any]:
    """Download the raw JSON description of a collection."""
    request = urllib.request.Request(
        f"{API_URL}/{key}",
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise SlowPicsError(f"Collection {key!r} was not found on slow.pics") from exc
        if exc.code in (401, 403):
            raise SlowPicsError(
                f"slow.pics refused access to collection {key!r} (HTTP {exc.code}). "
                "It may be private, or your network may be blocked by slow.pics' Cloudflare protection."
            ) from exc
        raise SlowPicsError(f"slow.pics returned HTTP {exc.code} for collection {key!r}") from exc
    except urllib.error.URLError as exc:
        raise SlowPicsError(f"Could not reach slow.pics: {exc.reason}") from exc
    except OSError as exc:  # timeouts and dropped connections while reading the body
        raise SlowPicsError(f"Could not read the response from slow.pics: {exc}") from exc

    try:
        data = json.loads(body)
    except ValueError as exc:
        raise SlowPicsError(f"slow.pics returned a non-JSON response for collection {key!r}") from exc
    if not isinstance(data, dict):
        raise SlowPicsError(f"Unexpected response from slow.pics for collection {key!r}")
    return data


def _ordered(items: list[Any]) -> list[Any]:
    """Sort API entries by their ``sortOrder`` field, keeping the original order as a fallback."""
    return [
        item
        for _, item in sorted(
            enumerate(items),
            key=lambda pair: (pair[1].get("sortOrder", pair[0]), pair[0]),
        )
    ]


def parse_collection(data: dict[str, Any], key: str | None = None) -> Collection:
    """Convert the JSON returned by the slow.pics API into a :class:`Collection`."""
    key = data.get("key") or key
    if not key:
        raise SlowPicsError("Collection data has no key")

    raw_comparisons = data.get("comparisons")
    if not isinstance(raw_comparisons, list):
        raise SlowPicsError(f"Unexpected collection format for {key!r}: no 'comparisons' list")

    comparisons = []
    for raw_comp in _ordered(raw_comparisons):
        images = []
        for raw_image in _ordered(raw_comp.get("images") or []):
            file_name = raw_image.get("publicFileName")
            if not file_name:
                raise SlowPicsError(f"Unexpected collection format for {key!r}: image without 'publicFileName'")
            images.append(Image(name=raw_image.get("name") or "", url=f"{IMAGE_URL}/{file_name}"))
        comparisons.append(Comparison(name=raw_comp.get("name") or "", images=tuple(images)))

    return Collection(key=key, name=data.get("name") or "", comparisons=tuple(comparisons))


def get_collection(value: str, timeout: float = 30.0) -> Collection:
    """Fetch a collection given its slow.pics URL or key."""
    key = parse_key(value)
    return parse_collection(fetch_collection_json(key, timeout=timeout), key=key)
