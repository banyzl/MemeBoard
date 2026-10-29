import { pinyin } from "pinyin-pro";
import { Meme, MemeInput } from "./models";
export const normalizeName = (text: string) => text.trim().normalize("NFC");
export function validateText(text: string, label: string): string {
  const value = normalizeName(text);
  if (!value || value.length > 128 || /[\x00-\x1f\x7f〔〕]/.test(value))
    throw new Error(`${label}须为 1～128 字，且不能含换行、制表符或提示括号`);
  return value;
}
export function pinyinTriggers(name: string): string[] {
  const syllables = pinyin(name, { toneType: "none", type: "array", v: true }).map((s) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  const full = syllables.join("");
  if (!full) return [];
  return [...new Set([full, syllables.map((s) => s[0] || "").join("")])];
}
export function validateInput(
  input: MemeInput,
  memes: Meme[],
  editingId?: string,
): MemeInput & { triggers: string[]; aliases: string[]; tags: string[] } {
  const name = validateText(input.name, "名称");
  const others = memes.filter((m) => m.id !== editingId);
  if (others.some((m) => m.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
    throw new Error(`名称「${name}」已存在，请重新命名`);
  const used = new Map(others.flatMap((m) => m.triggers.map((t) => [t, m.name] as const)));
  const supplied = input.triggers?.filter((t) => t.trim());
  let triggers: string[];
  if (supplied?.length) triggers = [...new Set(supplied.map((t) => t.trim().toLowerCase()))];
  else {
    const [full, initials] = pinyinTriggers(name);
    if (!full) throw new Error("名称无法生成拼音，请手动填写快捷码");
    triggers = [full];
    if (initials && !used.has(initials)) triggers.push(initials);
  }
  triggers = [...new Set(triggers)];
  for (const trigger of triggers) {
    if (!/^[a-z][a-z0-9]{0,63}$/.test(trigger))
      throw new Error(`快捷码「${trigger}」须以英文字母开头，仅含小写字母和数字，最多 64 位`);
    if (used.has(trigger)) throw new Error(`快捷码「${trigger}」已被「${used.get(trigger)}」使用`);
  }
  const list = (values: string[] | undefined, label: string) => [
    ...new Set((values || []).filter((v) => v.trim()).map((v) => validateText(v, label))),
  ];
  return {
    ...input,
    name,
    triggers,
    aliases: list(input.aliases, "别名"),
    tags: list(input.tags, "标签"),
  };
}
