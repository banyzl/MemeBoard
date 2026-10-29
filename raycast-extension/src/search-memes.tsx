import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Grid,
  Icon,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { Meme } from "./storage/models";
import { LocalSearchProvider } from "./search/local";
import { store } from "./settings";
import { MemeForm } from "./components/meme-form";
import { pasteMeme } from "./paste";
const search = new LocalSearchProvider();
export default function Command() {
  const [memes, setMemes] = useState<Meme[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useNavigation();
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMemes(
        (await store().read()).memes.sort(
          (a, b) =>
            Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    } catch (error) {
      await showToast(Toast.Style.Failure, "读取失败", (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function remove(meme: Meme) {
    if (
      !(await confirmAlert({
        title: `删除「${meme.name}」？`,
        message: "搜索和 Rime 索引中的记录将移除，图片保留在本地 trash 目录。",
        primaryAction: { title: "删除", style: Alert.ActionStyle.Destructive },
      }))
    )
      return;
    try {
      const result = await store().remove(meme.id);
      await showToast(
        result.indexWarning ? Toast.Style.Failure : Toast.Style.Success,
        result.indexWarning || "已删除",
      );
      await refresh();
    } catch (error) {
      await showToast(Toast.Style.Failure, "删除失败", (error as Error).message);
    }
  }
  const add = (
    <Action
      title="添加图片"
      icon={Icon.Plus}
      shortcut={{ modifiers: ["cmd"], key: "n" }}
      onAction={() => push(<MemeForm onSaved={refresh} />)}
    />
  );
  return (
    <Grid
      columns={5}
      aspectRatio="1"
      fit={Grid.Fit.Contain}
      isLoading={loading}
      searchBarPlaceholder="搜索名称、别名、标签或快捷码"
      filtering={true}
    >
      <Grid.EmptyView
        title="还没有表情包"
        description="添加一张图片，填写名称即可开始使用。"
        icon={Icon.Image}
        actions={<ActionPanel>{add}</ActionPanel>}
      />
      {memes.map((meme) => (
        <Grid.Item
          key={meme.id}
          id={meme.id}
          content={store().imagePath(meme)}
          title={meme.name}
          keywords={search.keywords(meme)}
          quickLook={{ path: store().imagePath(meme), name: meme.name }}
          actions={
            <ActionPanel>
              <Action title="粘贴图片" icon={Icon.Clipboard} onAction={() => pasteMeme(meme.id)} />
              <Action
                title="复制图片"
                icon={Icon.CopyClipboard}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
                onAction={() => pasteMeme(meme.id, true)}
              />
              <Action
                title="编辑图片"
                icon={Icon.Pencil}
                shortcut={{ modifiers: ["cmd"], key: "e" }}
                onAction={() => push(<MemeForm meme={meme} onSaved={refresh} />)}
              />
              <Action.ToggleQuickLook shortcut={{ modifiers: [], key: "space" }} />
              {add}
              <Action
                title="刷新"
                icon={Icon.ArrowClockwise}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={refresh}
              />
              <Action
                title="删除图片"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
                onAction={() => remove(meme)}
              />
            </ActionPanel>
          }
        />
      ))}
    </Grid>
  );
}
