#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
TEST_DIR=$(mktemp -d /private/tmp/memeboard-engine.XXXXXX)
trap 'rm -rf "$TEST_DIR"' EXIT
mkdir -p "$TEST_DIR/lua/wanxiang" "$TEST_DIR/lua/data" "$TEST_DIR/memeboard" "$TEST_DIR/build"
cp rime/meme_tips.lua "$TEST_DIR/lua/"
for name in super_tips wanxiang userdb; do cp "$HOME/Library/Rime/lua/wanxiang/$name.lua" "$TEST_DIR/lua/wanxiang/"; done
cat > "$TEST_DIR/lua/spike_translator.lua" <<'LUA'
return function(input,seg,env)
  yield(Candidate('memeboard_spike',seg.start,seg._end,input=='mmwy' and '普通候选' or '猫猫无语',''))
  for i=1,9 do yield(Candidate('memeboard_spike',seg.start,seg._end,'普通候选'..i,'')) end
end
LUA
printf 'Emoji：😂\tboth\n翻译：hello\tfanyi\n化学式：H₂O\thuaxue\n符号：→\tfuhao\n' > "$TEST_DIR/lua/data/tips_show.txt"
printf 'T\tmmwy\t7d31c15e-1111-4111-8111-000000000001\t猫猫无语\nN\t猫猫无语\t7d31c15e-1111-4111-8111-000000000001\t猫猫无语\n' > "$TEST_DIR/memeboard/index.tsv"
printf '1\n' > "$TEST_DIR/memeboard/version"
printf '#!/bin/sh\nprintf "%%s" "$2" > "%s/helper-called"\n' "$TEST_DIR" > "$TEST_DIR/helper"
chmod +x "$TEST_DIR/helper"
cat > "$TEST_DIR/memeboard_spike.schema.yaml" <<YAML
schema: {schema_id: memeboard_spike, name: MemeBoard Spike, version: '1'}
switches:
  - {name: ascii_mode, reset: 0}
  - {name: super_tips, reset: 1}
engine:
  processors:
    - lua_processor@*wanxiang.super_tips
    - speller
    - selector
    - express_editor
  segmentors: [abc_segmentor, fallback_segmentor]
  translators: [lua_translator@*spike_translator]
speller: {alphabet: abcdefghijklmnopqrstuvwxyz}
menu: {page_size: 5}
super_tips: {tips_key: comma, files: [lua/data/tips_show.txt]}
memeboard: {helper_path: '$TEST_DIR/helper'}
YAML
cat > "$TEST_DIR/memeboard_spike.custom.yaml" <<'YAML'
patch:
  engine/processors/@before 0: lua_processor@*meme_tips*before
  engine/processors/@after 0: lua_processor@*meme_tips*after
YAML
cat > "$TEST_DIR/default.yaml" <<'YAML'
config_version: '1'
schema_list: [{schema: memeboard_spike}]
YAML
clang -Ispikes spikes/rime-spike.c -o spikes/rime-spike
./spikes/rime-spike "$TEST_DIR"
