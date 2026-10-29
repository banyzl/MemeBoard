# Third-party notices

MemeBoard's original code is licensed under the [MIT License](LICENSE).

## librime C API header

`spikes/rime_api.h` is copied from librime 1.16.0 solely to compile the isolated
engine integration test. It retains the original RIME Developers copyright
notice and is licensed under BSD-3-Clause. The full upstream license is included
in [third_party/librime-LICENSE](third_party/librime-LICENSE).

Source: <https://github.com/rime/librime/blob/1.16.0/src/rime_api.h>

## Runtime dependencies

Raycast API, React, pinyin-pro, yaml, and development tools are installed through
npm using `raycast-extension/package-lock.json`. Their original licenses apply;
this repository does not vendor their source or installed packages.

## Wanxiang and Squirrel

The isolated integration tests load the user's installed Squirrel libraries and
copy the user's local Wanxiang modules into a temporary test directory. Those
upstream libraries, dictionaries, and modules are not redistributed in this
repository. MemeBoard's `rime/meme_tips.lua` is an independent integration module.

## Test images

Images in `tests/fixtures/` are synthetic diagnostic fixtures. The larger test
image contains only the words “MemeBoard Paste Test”; the WebP is a 1×1 test pixel.
No user meme library or chat screenshots are included.
