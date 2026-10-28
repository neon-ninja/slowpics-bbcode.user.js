import pytest

COMPARISON_JSON = {
    "id": "6d2b0c53-0000-0000-0000-000000000000",
    "key": "xnkAHiN5",
    "name": "Source vs Encode",
    "comparisons": [
        {
            "name": "Frame 2000",
            "sortOrder": 1,
            "images": [
                {"name": "Encode", "publicFileName": "MuGsudEN.png", "sortOrder": 1},
                {"name": "Source", "publicFileName": "EbVure2F.png", "sortOrder": 0},
            ],
        },
        {
            "name": "Frame 1000",
            "sortOrder": 0,
            "images": [
                {"name": "Source", "publicFileName": "UTc3iAI1.png", "sortOrder": 0},
                {"name": "Encode", "publicFileName": "OaZd0ndk.png", "sortOrder": 1},
            ],
        },
    ],
}

COLLECTION_JSON = {
    "key": "abcd1234",
    "name": "Screenshots",
    "comparisons": [
        {
            "name": "",
            "images": [
                {"name": "shot 1", "publicFileName": "lvptnOTb.png"},
                {"name": "shot 2", "publicFileName": "Qw3rTy12.png"},
            ],
        }
    ],
}


@pytest.fixture
def comparison_json():
    return COMPARISON_JSON


@pytest.fixture
def collection_json():
    return COLLECTION_JSON
