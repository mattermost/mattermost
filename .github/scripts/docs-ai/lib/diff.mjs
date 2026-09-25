/*
 * Synthesise an all-additions unified diff so pre-open persona review takes the
 * same prompt shape as docs-review.yml's git diff.
 */

export function additionsDiff(files) {
  const chunks = [];
  for (const {path, content} of files) {
    const lines = content === ''
      ? []
      : (() => {
          const body = content.endsWith('\n') ? content : `${content}\n`;
          const parts = body.split('\n');
          // Trailing empty from the final newline — drop it so +++ counts match.
          if (parts.at(-1) === '') parts.pop();
          return parts;
        })();

    const n = lines.length;
    chunks.push(
      `diff --git a/${path} b/${path}`,
      `new file mode 100644`,
      `--- /dev/null`,
      `+++ b/${path}`,
      n === 0 ? `@@ -0,0 +0,0 @@` : `@@ -0,0 +1,${n} @@`,
      ...lines.map((l) => `+${l}`),
    );
  }
  return chunks.join('\n') + (chunks.length ? '\n' : '');
}
