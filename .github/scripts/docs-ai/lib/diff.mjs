/*
 * Synthesise an all-additions unified diff so pre-open persona review takes the
 * same prompt shape as docs-review.yml's git diff.
 */

export function additionsDiff(files) {
  const chunks = [];
  for (const {path, content} of files) {
    const body = content.endsWith('\n') ? content : `${content}\n`;
    const lines = body.split('\n');
    // Trailing empty from the final newline — drop it so +++ counts match.
    if (lines.at(-1) === '') lines.pop();

    const n = lines.length;
    chunks.push(
      `diff --git a/${path} b/${path}`,
      `new file mode 100644`,
      `--- /dev/null`,
      `+++ b/${path}`,
      `@@ -0,0 +1,${n} @@`,
      ...lines.map((l) => `+${l}`),
    );
  }
  return chunks.join('\n') + (chunks.length ? '\n' : '');
}
