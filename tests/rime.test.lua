local module = dofile('rime/meme_tips.lua')
local dir = '/private/tmp/memeboard-lua-test-' .. tostring(os.time())
assert(os.execute('mkdir -p ' .. dir))
local id = '7d31c15e-1111-4111-8111-000000000001'
local function write(name, value) local f=assert(io.open(dir .. '/' .. name,'w')); f:write(value); f:close() end
local function index(name)
  write('index.tsv','T\tmmwy\t' .. id .. '\t' .. name .. '\nN\t' .. name .. '\t' .. id .. '\t' .. name .. '\n')
end
index('猫猫无语'); write('version','1'); write('helper','test')
local function notifier()
 local n={callbacks={}}
 function n:connect(fn) table.insert(self.callbacks,fn); return {disconnect=function() end} end
 function n:emit(ctx) for _,fn in ipairs(self.callbacks) do fn(ctx) end end
 return n
end
local seg={prompt='',selected_index=0,has_tag=function() return false end}
local props={}; local options={super_tips=true}
local ctx={input='mmwy',candidate={text='普通候选'},update_notifier=notifier(),option_update_notifier=notifier()}
ctx.composition={empty=function() return ctx.input=='' end,back=function() return seg end}
function ctx:get_option(k) return options[k] or false end
function ctx:get_property(k) return props[k] or '' end
function ctx:set_property(k,v) props[k]=v end
function ctx:get_selected_candidate() return self.candidate end
function ctx:clear() self.input=''; seg.prompt=''; self.update_notifier:emit(self) end
local config={get_string=function(_,k) return ({['memeboard/index_dir']=dir,['memeboard/helper_path']=dir..'/helper',['super_tips/tips_key']='comma'})[k] end}
local engine={context=ctx,schema={config=config,page_size=5}}
local before={engine=engine}; local after={engine=engine}
module.before.init(before)
-- Reproduce the exact upstream prompt lifecycle, including its equality check.
local official, last_prompt
ctx.update_notifier:connect(function(c)
 if official then seg.prompt='〔'..official..'〕'; last_prompt=seg.prompt
 elseif seg.prompt==last_prompt then seg.prompt=''; last_prompt='' end
end)
module.after.init(after)
local function update() ctx.update_notifier:emit(ctx) end
local function check(condition, message) assert(condition,message); print('PASS '..message) end
check(seg.prompt=='〔🖼️ 猫猫无语 · ,〕','raw trigger uses shared comma')
check(module.after.func({repr=function() return 'semicolon' end},after)==2,'inactive key falls through')
official='Emoji：😂'; update()
check(seg.prompt=='〔Emoji：😂〕 〔🖼️ 猫猫无语 · ;〕','simultaneous tips preserve comma, label fallback')
check(module.after.func({repr=function() return 'comma' end},after)==2,'shared key reserved for official tips')
official=nil; ctx.input='abc'; update()
check(seg.prompt=='','official and image prompts do not linger')
ctx.candidate={text='猫猫无语'}; update()
check(after.active_meme.id==id,'highlighted candidate matches incomplete raw input')
ctx.candidate={text='不存在'}; update(); check(seg.prompt=='','candidate movement removes tip')
ctx.input='mmwy'; seg.selected_index=5; update(); check(seg.prompt=='','later page ignores raw trigger')
ctx.candidate={text='猫猫无语'}; update(); check(after.active_meme.id==id,'later page matches candidate')
options.super_tips=false; ctx.option_update_notifier:emit(ctx); check(seg.prompt=='','Super Tips switch hides images')
options.super_tips=true; ctx.input='mmwy'; seg.selected_index=0
write('version','2'); write('index.tsv','broken'); after.last_check=nil; update()
check(after.active_meme.id==id,'bad reload retains previous cache')
write('version','3'); index('新图片'); after.last_check=nil; update()
check(after.active_meme.name=='新图片','version change reloads cache')
write('version','4'); write('index.tsv',''); after.last_check=nil; ctx.candidate={text='普通候选'}; update()
check(seg.prompt=='','deleted index removes active meme')
write('version','5'); index('猫猫无语'); after.last_check=nil; update()
local old=os.execute; local command
os.execute=function(c) command=c; return true end
check(module.after.func({repr=function() return 'comma' end},after)==1,'image key accepted')
check(ctx.input=='' and command:find(id,1,true),'composition clears before detached UUID helper launch')
check(command:sub(-1)=='&','helper launched asynchronously')
os.execute=old
module.before.fini(before); module.after.fini(after)
assert(os.execute('rm -rf ' .. dir))
