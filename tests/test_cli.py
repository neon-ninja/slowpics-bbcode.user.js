import pytest

from slowpics_cli import api, cli


@pytest.fixture
def fake_api(monkeypatch, comparison_json, collection_json):
    data = {"xnkAHiN5": comparison_json, "abcd1234": collection_json}
    monkeypatch.setattr(api, "fetch_collection_json", lambda key, timeout=30.0: data[key])


def run(capsys, *argv):
    code = cli.main(list(argv))
    out, err = capsys.readouterr()
    return code, out, err


def test_list(fake_api, capsys):
    code, out, _ = run(capsys, "list", "https://slow.pics/c/xnkAHiN5")
    assert code == 0
    assert out.splitlines()[:2] == [
        "Source vs Encode",
        "https://slow.pics/c/xnkAHiN5 (comparison: 2 comparisons, 2 sources, 4 images)",
    ]
    assert "[1] Frame 1000" in out
    assert "    2. Encode  https://i.slow.pics/MuGsudEN.png" in out


def test_bbcode_auto_comparison(fake_api, capsys):
    code, out, _ = run(capsys, "bbcode", "xnkAHiN5")
    assert code == 0
    assert out == (
        "[comparison=Source, Encode]\n"
        "https://i.slow.pics/UTc3iAI1.png, https://i.slow.pics/OaZd0ndk.png\n"
        "https://i.slow.pics/EbVure2F.png, https://i.slow.pics/MuGsudEN.png\n"
        "[/comparison]\n"
    )


def test_bbcode_auto_collection(fake_api, capsys):
    _, out, _ = run(capsys, "bbcode", "https://slow.pics/c/abcd1234")
    assert out == "[img]https://i.slow.pics/lvptnOTb.png[/img]\n[img]https://i.slow.pics/Qw3rTy12.png[/img]\n"


def test_bbcode_selection_and_labels(fake_api, capsys):
    _, out, _ = run(capsys, "bbcode", "xnkAHiN5", "-c", "2", "-s", "Encode", "-s", "Source", "-l", "Mine,Theirs")
    assert out == "[comparison=Mine, Theirs]\nhttps://i.slow.pics/MuGsudEN.png, https://i.slow.pics/EbVure2F.png\n[/comparison]\n"


def test_bbcode_forced_img_format(fake_api, capsys):
    _, out, _ = run(capsys, "bbcode", "xnkAHiN5", "--format", "img", "-c", "1")
    assert out == "[img]https://i.slow.pics/UTc3iAI1.png[/img]\n[img]https://i.slow.pics/OaZd0ndk.png[/img]\n"


def test_errors_go_to_stderr(fake_api, capsys):
    code, out, err = run(capsys, "bbcode", "https://example.com/c/xnkAHiN5")
    assert code == 1
    assert out == ""
    assert err.startswith("slowpics: error: Not a slow.pics collection URL or key")
