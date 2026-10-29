import { Action, ActionPanel, Clipboard, Form, environment, showToast, Toast } from "@raycast/api";
export default function Command() {
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Test Paste into QQ"
            onSubmit={async (values: { files: string[] }) => {
              if (!values.files?.[0]) {
                await showToast(Toast.Style.Failure, "Choose a PNG first");
                return;
              }
              await Clipboard.paste({ file: values.files[0] });
            }}
          />
        </ActionPanel>
      }
    >
      <Form.FilePicker
        defaultValue={[`${environment.assetsPath}/test.png`]}
        id="files"
        title="PNG Image"
        allowMultipleSelection={false}
      />
      <Form.Description text="Focus an empty QQ input before opening this command. This only pastes; it does not send." />
    </Form>
  );
}
