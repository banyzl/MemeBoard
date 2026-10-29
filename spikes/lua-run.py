#!/usr/bin/env python3
"""Run Lua with the exact interpreter embedded in installed Squirrel, no installs."""
import ctypes, sys
ctypes.CDLL('/Library/Input Methods/Squirrel.app/Contents/Frameworks/librime.1.dylib', mode=ctypes.RTLD_GLOBAL)
lib = ctypes.CDLL('/Library/Input Methods/Squirrel.app/Contents/Frameworks/rime-plugins/librime-lua.dylib')
lib.luaL_newstate.restype=ctypes.c_void_p
lib.luaL_openlibs.argtypes=[ctypes.c_void_p]
lib.luaL_loadfilex.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_char_p]
lib.lua_pcallk.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_longlong,ctypes.c_void_p]
lib.lua_tolstring.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_void_p]
lib.lua_tolstring.restype=ctypes.c_char_p
lib.lua_close.argtypes=[ctypes.c_void_p]
L=lib.luaL_newstate(); lib.luaL_openlibs(L)
status=lib.luaL_loadfilex(L,sys.argv[1].encode(),None)
if not status: status=lib.lua_pcallk(L,0,-1,0,0,None)
if status: print(lib.lua_tolstring(L,-1,None).decode(),file=sys.stderr)
lib.lua_close(L); sys.exit(1 if status else 0)
