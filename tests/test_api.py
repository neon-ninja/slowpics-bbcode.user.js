import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from slowpics_cli import api
from slowpics_cli.api import SlowPicsError, parse_collection, parse_key


@pytest.mark.parametrize(
    "value",
    [
        "xnkAHiN5",
        "  xnkAHiN5\n",
        "https://slow.pics/c/xnkAHiN5",
        "http://slow.pics/c/xnkAHiN5",
        "https://www.slow.pics/c/xnkAHiN5",
        "slow.pics/c/xnkAHiN5",
        "https://slow.pics/c/xnkAHiN5/",
        "https://slow.pics/c/xnkAHiN5?image-fit=contain",
        "https://slow.pics/c/xnkAHiN5#3",
        "https://slow.pics/api/comparison/xnkAHiN5",
    ],
)
def test_parse_key_accepts_urls_and_keys(value):
    assert parse_key(value) == "xnkAHiN5"


@pytest.mark.parametrize(
    "value",
    ["", "https://example.com/c/xnkAHiN5", "https://slow.pics/", "https://slow.pics/c/", "not a key!"],
)
def test_parse_key_rejects_garbage(value):
    with pytest.raises(SlowPicsError):
        parse_key(value)


def test_parse_collection_orders_and_builds_urls(comparison_json):
    collection = parse_collection(comparison_json)
    assert collection.key == "xnkAHiN5"
    assert collection.url == "https://slow.pics/c/xnkAHiN5"
    assert [comp.name for comp in collection.comparisons] == ["Frame 1000", "Frame 2000"]
    assert [img.name for img in collection.comparisons[1].images] == ["Source", "Encode"]
    assert collection.comparisons[0].images[0].url == "https://i.slow.pics/UTc3iAI1.png"
    assert collection.is_comparison


def test_plain_collection_is_not_a_comparison(collection_json):
    assert not parse_collection(collection_json).is_comparison


def test_parse_collection_uses_requested_key_when_missing():
    collection = parse_collection({"comparisons": []}, key="abc")
    assert collection.key == "abc"
    assert not collection.is_comparison


@pytest.mark.parametrize(
    "data",
    [
        {"key": "abc"},
        {"key": "abc", "comparisons": [{"name": "x", "images": [{"name": "y"}]}]},
    ],
)
def test_parse_collection_rejects_unknown_format(data):
    with pytest.raises(SlowPicsError):
        parse_collection(data)


class _Handler(BaseHTTPRequestHandler):
    responses = {}

    def do_GET(self):
        status, body = self.responses.get(self.path, (404, b"not found"))
        self.send_response(status)
        self.end_headers()
        self.wfile.write(body)
        type(self).last_headers = self.headers

    def log_message(self, *args):
        pass


@pytest.fixture
def server(monkeypatch):
    httpd = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    monkeypatch.setattr(api, "API_URL", f"http://127.0.0.1:{httpd.server_port}/api/comparison")
    yield _Handler.responses
    httpd.shutdown()
    _Handler.responses.clear()


def test_get_collection_over_http(server, comparison_json):
    server["/api/comparison/xnkAHiN5"] = (200, json.dumps(comparison_json).encode())
    collection = api.get_collection("https://slow.pics/c/xnkAHiN5")
    assert len(collection.comparisons) == 2
    assert _Handler.last_headers["User-Agent"].startswith("slowpics-cli/")


@pytest.mark.parametrize(
    "status, body, message",
    [
        (404, b"", "not found"),
        (403, b"", "refused access"),
        (500, b"", "HTTP 500"),
        (200, b"<html>", "non-JSON"),
    ],
)
def test_get_collection_errors(server, status, body, message):
    server["/api/comparison/missing1"] = (status, body)
    with pytest.raises(SlowPicsError, match=message):
        api.get_collection("missing1")
