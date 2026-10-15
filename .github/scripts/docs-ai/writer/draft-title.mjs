const PREFIX = 'docs: AI draft for ';
const MAX_LEN = 240;

/**
 * Draft PR title from the merged PR's title.
 * Strips a leading "docs:" so the prefix is not doubled, and drops control
 * characters so the title stays a single git/GitHub line.
 */
export function draftTitle(sourceTitle) {
  const cleaned = String(sourceTitle ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^docs:\s*/i, '');
  let subject = cleaned || 'documentation update';
  const room = MAX_LEN - PREFIX.length;
  if (subject.length > room) {
    const cut = subject.slice(0, room - 3);
    const space = cut.lastIndexOf(' ');
    subject = `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}...`;
  }
  return PREFIX + subject;
}
