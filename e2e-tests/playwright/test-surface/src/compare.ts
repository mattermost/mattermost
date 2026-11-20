// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** Orders strings by code unit, the same on every machine (unlike `localeCompare`), so outputs are stable. */
export function cmp(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    return a > b ? 1 : 0;
}

/**
 * Orders locations (`file:line:column`) by file, then by position: `a.tsx:9:1` before `a.tsx:10:1`, so code added
 * above two places doesn't swap them, as it can in text order (`a.tsx:95` and `a.tsx:101`).
 */
export function cmpLoc(a: string, b: string): number {
    const pa = (/^(.*?)((?::\d+)*)$/).exec(a)!;
    const pb = (/^(.*?)((?::\d+)*)$/).exec(b)!;
    const byFile = cmp(pa[1], pb[1]);
    if (byFile) {
        return byFile;
    }
    const na = pa[2].split(':').slice(1).map(Number);
    const nb = pb[2].split(':').slice(1).map(Number);
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
        const d = (na[i] ?? -1) - (nb[i] ?? -1);
        if (d) {
            return d;
        }
    }
    return 0;
}

/** Orders usage chains location by location. */
export function cmpLocs(a: string[], b: string[]): number {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const d = cmpLoc(a[i], b[i]);
        if (d) {
            return d;
        }
    }
    return a.length - b.length;
}
