assert(os.execute("/usr/bin/true"))
local t = os.time()
assert(os.execute("/usr/bin/true >/dev/null 2>&1 &"))
print("Squirrel embedded Lua: os.execute available; detached launch returns, elapsed=" .. (os.time()-t) .. "s")
