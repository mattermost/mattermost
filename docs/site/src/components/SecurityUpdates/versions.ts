export type Version = [number, number, number];
export type VersionRange = {min: Version; max: Version};

const INF = 999_999;
const ZERO: Version = [0, 0, 0];
const MAX: Version = [INF, INF, INF];

export function parseVersionToken(raw: string): Version | null {
  const cleaned = raw.trim().replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+|x))?/i);
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  const minor = match[2] === undefined ? 0 : Number(match[2]);
  const patchToken = match[3];
  const patch =
    patchToken === undefined ? 0 : patchToken.toLowerCase() === 'x' ? 0 : Number(patchToken);
  return [major, minor, patch];
}

export function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}

function exclusiveUpperBound(v: Version): Version {
  if (v[2] > 0) {
    return [v[0], v[1], v[2] - 1];
  }
  if (v[1] > 0) {
    return [v[0], v[1] - 1, INF];
  }
  if (v[0] > 0) {
    return [v[0] - 1, INF, INF];
  }
  return ZERO;
}

function versionFromMatch(token: string, asUpperBound: boolean): Version | null {
  const parsed = parseVersionToken(token);
  if (!parsed) {
    return null;
  }
  if (asUpperBound && /\.x$/i.test(token.trim().replace(/^v/i, ''))) {
    return [parsed[0], parsed[1], INF];
  }
  // "11.9" as a max means the whole 11.9 line.
  if (asUpperBound && /^\d+\.\d+$/.test(token.trim().replace(/^v/i, ''))) {
    return [parsed[0], parsed[1], INF];
  }
  return parsed;
}

function parseOneLine(line: string): VersionRange[] {
  const text = line.trim();
  if (!text || /^(n\/a|na)$/i.test(text) || /^exclud/i.test(text)) {
    return [];
  }

  if (/^all$/i.test(text)) {
    return [{min: ZERO, max: MAX}];
  }

  const toMatch = text.match(
    /v?(\d+(?:\.\d+){0,2}(?:\.x)?)\s+to\s+v?(\d+(?:\.\d+){0,2}(?:\.x)?)/i,
  );
  if (toMatch) {
    const min = versionFromMatch(toMatch[1], false);
    const max = versionFromMatch(toMatch[2], true);
    if (min && max) {
      return [{min, max}];
    }
  }

  const earlier = text.match(/v?(\d+(?:\.\d+){0,2}(?:\.x)?)\s+and earlier/i);
  if (earlier) {
    const max = versionFromMatch(earlier[1], true);
    if (max) {
      return [{min: ZERO, max}];
    }
  }

  if (text.includes('<=')) {
    const segments = text.split('<=');
    const left = (segments[0] || '').trim();
    const maxes = segments
      .slice(1)
      .map((part) => versionFromMatch(part.trim().split(/\s+/)[0] || '', true))
      .filter((max): max is Version => max !== null);
    if (maxes.length === 0) {
      return [];
    }
    const branch = left.match(/(\d+)\.(\d+)\.x/i);
    if (branch && maxes.length === 1) {
      return [{min: [Number(branch[1]), Number(branch[2]), 0], max: maxes[0]}];
    }
    if (maxes.length > 1) {
      return maxes.map((max) => ({min: ZERO, max}));
    }
    const leftVer = parseVersionToken(left.replace(/^.*\s/, ''));
    if (leftVer) {
      return [{min: leftVer, max: maxes[0]}];
    }
    return [{min: ZERO, max: maxes[0]}];
  }

  if (text.includes('>=')) {
    const min = versionFromMatch(text.split('>=')[1] || '', false);
    if (min) {
      return [{min, max: MAX}];
    }
  }

  if (text.includes('<')) {
    const ranges: VersionRange[] = [];
    for (const match of text.matchAll(/<\s*v?(\d+(?:\.\d+){0,2}(?:\.x)?)/gi)) {
      // Exclusive bound: do not expand "7.9" to the whole 7.9 line first.
      const bound = versionFromMatch(match[1], false);
      if (bound) {
        ranges.push({min: ZERO, max: exclusiveUpperBound(bound)});
      }
    }
    if (ranges.length > 0) {
      return ranges;
    }
  }

  const ranges: VersionRange[] = [];
  for (const match of text.matchAll(/v?(\d+\.\d+(?:\.\d+|\.x)?)/gi)) {
    const token = match[1];
    const version = parseVersionToken(token);
    if (version) {
      ranges.push({min: version, max: version});
    }
  }
  return ranges;
}

function highestFixVersion(fixVersions: string[]): Version | null {
  let highest: Version | null = null;
  for (const line of fixVersions) {
    for (const match of line.matchAll(/v?(\d+\.\d+(?:\.\d+)?)/gi)) {
      const parsed = parseVersionToken(match[1]);
      if (!parsed) {
        continue;
      }
      if (!highest || compareVersions(parsed, highest) > 0) {
        highest = parsed;
      }
    }
  }
  return highest;
}

function isUnbounded(range: VersionRange): boolean {
  return compareVersions(range.max, MAX) === 0;
}

export function parseAffectedLines(lines: string[], fixVersions: string[] = []): VersionRange[] {
  const ranges = lines.flatMap(parseOneLine);
  const cap = highestFixVersion(fixVersions);
  if (!cap) {
    return ranges;
  }
  return ranges.map((range) => {
    if (!isUnbounded(range)) {
      return range;
    }
    return {
      min: range.min,
      max: compareVersions(cap, range.min) < 0 ? range.min : cap,
    };
  });
}

export function rangesOverlap(a: VersionRange, b: VersionRange): boolean {
  return compareVersions(a.min, b.max) <= 0 && compareVersions(b.min, a.max) <= 0;
}

export function rowMatchesVersionRange(
  ranges: VersionRange[],
  minFilter: Version | null,
  maxFilter: Version | null,
): boolean {
  if (!minFilter && !maxFilter) {
    return true;
  }
  if (ranges.length === 0) {
    return false;
  }
  const filter: VersionRange = {
    min: minFilter ?? ZERO,
    max: maxFilter ?? MAX,
  };
  return ranges.some((range) => rangesOverlap(range, filter));
}

export function labelToVersion(label: string, bound: 'min' | 'max'): Version | null {
  const trimmed = label.trim();
  if (!trimmed || !/^v?\d+(?:\.\d+){0,2}(?:\.x)?$/i.test(trimmed)) {
    return null;
  }
  return versionFromMatch(trimmed, bound === 'max');
}
