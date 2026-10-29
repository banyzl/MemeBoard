import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useMemo, useState } from "react";
import { Meme } from "../storage/models";
import { pinyinTriggers } from "../storage/triggers";
import { store } from "../settings";
interface Values {
  files: string[];
  name: string;
  triggers: string;
  aliases: string;
  tags: string;
  favorite: boolean;
}
const split = (text: string) =>
  text
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
export function MemeForm({ meme, onSaved }: { meme?: Meme; onSaved?: () => void }) {
  const [name, setName] = useState(meme?.name || "");
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const suggestions = useMemo(
    () => (name ? pinyinTriggers(name).join("、") : "填写名称后自动生成"),
    [name],
  );
  const { pop } = useNavigation();
  async function submit(values: Values) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      if (!meme && !values.files?.length) throw new Error("请选择图片");
      const input = {
        name: values.name,
        triggers: split(values.triggers),
        aliases: split(values.aliases),
        tags: split(values.tags),
        favorite: values.favorite,
      };
      const db = store();
      const result = meme
        ? await db.update(meme.id, input)
        : await db.importImage(values.files[0], input);
      await showToast({
        style: result.indexWarning ? Toast.Style.Failure : Toast.Style.Success,
        title: result.indexWarning ? "已保存，索引待修复" : "图片已保存",
        message: result.indexWarning,
      });
      onSaved?.();
      pop();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      await showToast(Toast.Style.Failure, "保存失败", message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Form
      isLoading={busy}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={meme ? "保存修改" : "导入图片"} onSubmit={submit} />
        </ActionPanel>
      }
    >
      {!meme && (
        <Form.FilePicker
          value={files}
          onChange={setFiles}
          id="files"
          title="图片"
          allowMultipleSelection={false}
          canChooseDirectories={false}
        />
      )}
      <Form.TextField
        id="name"
        title="名称"
        value={name}
        onChange={setName}
        error={error}
        placeholder="猫猫无语"
      />
      <Form.TextArea
        id="triggers"
        title="快捷码"
        defaultValue={meme?.triggers.join("\n")}
        placeholder="留空自动生成；多个快捷码每行一个"
        info="全局唯一，使用英文字母与数字。填写后使用你指定的快捷码。"
      />
      <Form.Description title="拼音建议" text={suggestions} />
      <Form.TextArea
        id="aliases"
        title="别名"
        defaultValue={meme?.aliases.join("\n")}
        placeholder="无语猫\n沉默猫"
      />
      <Form.TextArea
        id="tags"
        title="标签"
        defaultValue={meme?.tags.join("\n")}
        placeholder="猫\n无语\n沉默"
      />
      <Form.Checkbox id="favorite" label="收藏" defaultValue={meme?.favorite || false} />
      <Form.Description text="图片会复制到本地资料库，原文件会保留。名称须唯一。别名和标签用于 Raycast 搜索。" />
    </Form>
  );
}
