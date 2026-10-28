# slow.pics CLI

A small command-line tool for working with [slow.pics](https://slow.pics) collections. It lists the
comparisons in a collection and prints them as BBCode ready to paste into a forum post. It has no
dependencies beyond the Python standard library (3.9+).

## Install

```bash
pip install git+https://github.com/neon-ninja/slow.pics.CLI
```

or, from a checkout, `pip install .` (or `pipx install .`). This installs a `slowpics` command;
`python -m slowpics_cli` works too.

## Usage

Every command takes the collection either as its full URL or just its key, so these are equivalent:

```bash
slowpics bbcode https://slow.pics/c/xnkAHiN5
slowpics bbcode xnkAHiN5
```

### List the comparisons in a collection

```console
$ slowpics list xnkAHiN5
Source vs Encode
https://slow.pics/c/xnkAHiN5 (comparison: 2 comparisons, 2 sources, 4 images)

[1] Frame 1000
    1. Source  https://i.slow.pics/UTc3iAI1.png
    2. Encode  https://i.slow.pics/OaZd0ndk.png

[2] Frame 2000
    1. Source  https://i.slow.pics/EbVure2F.png
    2. Encode  https://i.slow.pics/MuGsudEN.png
```

The numbers in brackets are the comparison numbers, and the numbers beneath them are the source
numbers. Both can be used to choose what `slowpics bbcode` prints.

### Print BBCode

For a comparison, you get a `[comparison=...]` block with one comparison per line and one image per
source on each line:

```console
$ slowpics bbcode https://slow.pics/c/xnkAHiN5
[comparison=Source, Encode]
https://i.slow.pics/UTc3iAI1.png, https://i.slow.pics/OaZd0ndk.png
https://i.slow.pics/EbVure2F.png, https://i.slow.pics/MuGsudEN.png
[/comparison]
```

For a plain image collection, you get one `[img]` tag per image, like slow.pics shows after
uploading a collection:

```console
$ slowpics bbcode abcd1234
[img]https://i.slow.pics/lvptnOTb.png[/img]
[img]https://i.slow.pics/Qw3rTy12.png[/img]
```

#### Options

| Option | Effect |
| --- | --- |
| `-c`, `--comparison SELECTOR` | Include only this comparison. It takes a name, a number from `slowpics list`, or a range such as `2-5`, and can be repeated. Names take precedence over numbers. |
| `-s`, `--source SELECTOR` | Include only this source from each comparison, by name or number. Repeat it to pick several, in the order they should appear. |
| `-f`, `--format {auto,comparison,img}` | Choose the output style. `auto`, the default, picks based on whether the collection was uploaded as a comparison. |
| `-l`, `--labels NAMES` | Set the comma-separated names for the `[comparison=...]` header. By default these are the image names from the first comparison. |
| `--timeout SECONDS` | Set the network timeout (global, so it goes before the command). |

Examples:

```bash
# Only comparisons 1 to 3 and 7, with Encode listed before Source
slowpics bbcode xnkAHiN5 -c 1-3 -c 7 -s Encode -s Source

# Rename the header
slowpics bbcode xnkAHiN5 --labels "BD, Encode"

# Every image as an [img] tag, even for a comparison
slowpics bbcode xnkAHiN5 --format img

# Copy straight to the clipboard (Linux / macOS)
slowpics bbcode xnkAHiN5 | xclip -selection clipboard
slowpics bbcode xnkAHiN5 | pbcopy
```

## How it works

The tool reads the collection's JSON from `https://slow.pics/api/comparison/<key>` and builds image
links as `https://i.slow.pics/<publicFileName>`. Requests identify themselves with a
`slowpics-cli/<version>` User-Agent.

## Development

```bash
pip install -e ".[test]"
pytest
```
