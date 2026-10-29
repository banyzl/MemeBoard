import { getPreferenceValues } from "@raycast/api";
import { homedir } from "node:os";
import { join } from "node:path";
import { MemeStore } from "./storage/database";
export function store(): MemeStore {
  const preferences = getPreferenceValues<{ rimeDirectory?: string }>();
  return new MemeStore({
    rimeDir: preferences.rimeDirectory?.trim() || join(homedir(), "Library/Rime"),
  });
}
