import pytest

from slowpics_cli.api import SlowPicsError, parse_collection
from slowpics_cli.bbcode import comparison_bbcode, img_bbcode, select_comparisons, select_sources


@pytest.fixture
def comparisons(comparison_json):
    return parse_collection(comparison_json).comparisons


def test_comparison_bbcode_matches_slowpics_style(comparisons):
    assert comparison_bbcode(comparisons) == (
        "[comparison=Source, Encode]\n"
        "https://i.slow.pics/UTc3iAI1.png, https://i.slow.pics/OaZd0ndk.png\n"
        "https://i.slow.pics/EbVure2F.png, https://i.slow.pics/MuGsudEN.png\n"
        "[/comparison]"
    )


def test_comparison_bbcode_custom_labels(comparisons):
    assert comparison_bbcode(comparisons[:1], ["Remux", "Mine"]).splitlines()[0] == "[comparison=Remux, Mine]"


def test_img_bbcode(collection_json):
    collection = parse_collection(collection_json)
    assert img_bbcode(collection.comparisons) == (
        "[img]https://i.slow.pics/lvptnOTb.png[/img]\n[img]https://i.slow.pics/Qw3rTy12.png[/img]"
    )


@pytest.mark.parametrize(
    "selectors, expected",
    [
        (["2"], ["Frame 2000"]),
        (["frame 2000", "1"], ["Frame 2000", "Frame 1000"]),
        (["1-2"], ["Frame 1000", "Frame 2000"]),
        (["2-1"], ["Frame 1000", "Frame 2000"]),
    ],
)
def test_select_comparisons(comparisons, selectors, expected):
    assert [comp.name for comp in select_comparisons(comparisons, selectors)] == expected


@pytest.mark.parametrize("selector", ["3", "0", "1-3", "Frame 9"])
def test_select_comparisons_errors(comparisons, selector):
    with pytest.raises(SlowPicsError):
        select_comparisons(comparisons, [selector])


def test_select_sources_by_name_and_number(comparisons):
    selected = select_sources(comparisons, ["encode", "1"])
    assert [[img.name for img in comp.images] for comp in selected] == [["Encode", "Source"]] * 2


@pytest.mark.parametrize("selector", ["3", "Filtered"])
def test_select_sources_errors(comparisons, selector):
    with pytest.raises(SlowPicsError):
        select_sources(comparisons, [selector])
