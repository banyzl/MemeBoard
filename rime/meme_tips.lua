-- Independent Wanxiang integration. Register before immediately before Super Tips,
-- and after immediately after it. No upstream files or candidate order are changed.
local M = { before = {}, after = {} }
local NOOP, ACCEPTED = 2, 1
local UUID = '^%x%x%x%x%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%x%x%x%x%x%x%x%x$'
local function segment(ctx)
  if ctx.composition:empty() then return nil end
  return ctx.composition:back()
end
local function strip(ctx)
  local seg = segment(ctx)
  local suffix = ctx:get_property('memeboard_suffix') or ''
  if seg and suffix ~= '' and (seg.prompt or ''):sub(-#suffix) == suffix then
    seg.prompt = seg.prompt:sub(1, #seg.prompt - #suffix)
  end
  ctx:set_property('memeboard_suffix', '')
end
function M.before.init(env)
  env.connection = env.engine.context.update_notifier:connect(strip)
end
function M.before.func() return NOOP end
function M.before.fini(env)
  if env.connection then env.connection:disconnect() end
end
local function read_version(dir)
  local f = io.open(dir .. '/version', 'r')
  if not f then return nil end
  local v = f:read('*l'); f:close()
  return v
end
local function reload(env)
  local now = os.time()
  if env.last_check and now == env.last_check then return end
  env.last_check = now
  local version = read_version(env.index_dir)
  if not version or version == env.version then return end
  local f = io.open(env.index_dir .. '/index.tsv', 'r')
  if not f then return end
  local triggers, names, valid = {}, {}, true
  local readable = pcall(function()
  for line in f:lines() do
    local kind, key, id, name = line:match('^([TN])\t([^\t\r\n]+)\t([^\t]+)\t([^\t\r\n]+)$')
    if not kind or not id:match(UUID) then valid = false; break end
    local map = kind == 'T' and triggers or names
    if map[key] then valid = false; break end
    map[key] = {id = id, name = name}
  end
  end)
  f:close()
  if readable and valid and read_version(env.index_dir) == version then
    env.triggers, env.names, env.version = triggers, names, version
  end
end
local function disabled(ctx, seg)
  if not ctx:get_option('super_tips') or ctx:get_option('ascii_mode') or not seg then return true end
  for _, tag in ipairs({'number', 'unicode', 'calculator', 'shijian', 'super_symbol', 'wanxiang_reverse'}) do
    if seg:has_tag(tag) then return true end
  end
  return not ctx.input or ctx.input == '' or ctx.input:find('^›') ~= nil
end
local function key_label(key)
  return ({comma=',', semicolon=';', slash='/'})[key] or key
end
local function update(ctx, env)
  strip(ctx)
  env.active_meme = nil
  reload(env)
  local seg = segment(ctx)
  if disabled(ctx, seg) then return end
  local candidate = ctx:get_selected_candidate()
  local meme
  if seg.selected_index < env.page_size then meme = env.triggers[ctx.input] end
  meme = meme or (candidate and env.names[candidate.text])
  if not meme then return end
  -- A nonempty existing prompt conservatively reserves the upstream tips key.
  local base = seg.prompt or ''
  local shared = env.meme_key == env.tips_key
  local key = shared and base ~= '' and env.fallback_key or env.meme_key
  local suffix = (base ~= '' and ' ' or '') .. '〔🖼️ ' .. meme.name .. ' · ' .. key_label(key) .. '〕'
  seg.prompt = base .. suffix
  ctx:set_property('memeboard_suffix', suffix)
  env.active_meme = {id=meme.id, name=meme.name, key=key, input=ctx.input, segment=seg}
end
function M.after.init(env)
  local config = env.engine.schema.config
  env.index_dir = config:get_string('memeboard/index_dir') or (rime_api.get_user_data_dir() .. '/memeboard')
  env.helper = config:get_string('memeboard/helper_path') or ((os.getenv('HOME') or '') .. '/Library/Application Support/MemeBoard/bin/memeboard-helper')
  env.tips_key = config:get_string('super_tips/tips_key') or 'comma'
  env.meme_key = config:get_string('memeboard/meme_key') or env.tips_key
  env.fallback_key = config:get_string('memeboard/fallback_key') or 'semicolon'
  -- Never let a conflicting fallback steal the upstream key.
  if env.fallback_key == env.tips_key then env.fallback_key = 'semicolon' end
  if env.fallback_key == env.tips_key then env.fallback_key = 'Control+semicolon' end
  env.page_size = env.engine.schema.page_size or 5
  env.triggers, env.names = {}, {}
  env.connection = env.engine.context.update_notifier:connect(function(ctx) update(ctx, env) end)
  env.option_connection = env.engine.context.option_update_notifier:connect(function(ctx) update(ctx, env) end)
  update(env.engine.context, env)
end
local function quote(s) return "'" .. s:gsub("'", "'\\''") .. "'" end
function M.after.func(key, env)
  local ctx = env.engine.context
  local active = env.active_meme
  if not active or key:repr() ~= active.key then return NOOP end
  local seg = segment(ctx)
  if disabled(ctx, seg) or ctx.input ~= active.input or not active.id:match(UUID) then return NOOP end
  local suffix = ctx:get_property('memeboard_suffix') or ''
  if suffix == '' or (seg.prompt or ''):sub(-#suffix) ~= suffix then return NOOP end
  local f = io.open(env.helper, 'rb')
  if not f then return NOOP end
  f:close()
  -- Clear before launching. The helper defers Cmd+V and keeps foreground focus.
  local id = active.id
  ctx:clear()
  env.active_meme = nil
  os.execute(quote(env.helper) .. ' paste ' .. quote(id) .. ' >/dev/null 2>&1 &')
  return ACCEPTED
end
function M.after.fini(env)
  strip(env.engine.context)
  if env.connection then env.connection:disconnect() end
  if env.option_connection then env.option_connection:disconnect() end
  env.active_meme = nil
end
return M
