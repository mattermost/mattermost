// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {resolveTemplate} from './journey_charter.ts';
import type {Bindings, JourneyCharter} from './journey_charter.ts';
import {parseSnapshot, walk} from './snapshot.ts';
import type {SnapNode} from './snapshot.ts';
import type {ClauseResult} from './journey_rest.ts';

/** Inline text after the `role "name":` key on a node's own line (not its children). */
export function inlineText(node: SnapNode): string {
    const idx = node.line.indexOf(':');
    if (idx < 0) {
        return '';
    }
    let rest = node.line.slice(idx + 1).trim();
    if ((rest.startsWith('"') && rest.endsWith('"')) || (rest.startsWith("'") && rest.endsWith("'"))) {
        rest = rest.slice(1, -1);
    }
    return rest;
}

/** All visible text of a node's subtree: inline text plus each descendant's name and inline text. */
export function subtreeText(node: SnapNode): string {
    const parts: string[] = [inlineText(node)];
    for (const child of node.children) {
        if (child.name) {
            parts.push(child.name);
        }
        parts.push(subtreeText(child));
    }
    return parts.filter(Boolean).join(' ');
}

export function plainText(nodes: SnapNode[]): string {
    const parts: string[] = [];
    walk(nodes, (n) => {
        if (n.name) {
            parts.push(n.name);
        }
        const inline = inlineText(n);
        if (inline) {
            parts.push(inline);
        }
    });
    return parts.join(' ');
}

export function occurrences(haystack: string, needle: string): number {
    if (!needle) {
        return 0;
    }
    let n = 0;
    let i = haystack.indexOf(needle);
    while (i >= 0) {
        n++;
        i = haystack.indexOf(needle, i + needle.length);
    }
    return n;
}

function findNodes(nodes: SnapNode[], predicate: (n: SnapNode) => boolean): SnapNode[] {
    const out: SnapNode[] = [];
    walk(nodes, (n) => {
        if (predicate(n)) {
            out.push(n);
        }
    });
    return out;
}

export type UiCheckpointResult = {
    id: string;
    ok: boolean;
    clauses: ClauseResult[];
    observation: string[];
};

export type ThreadsReport = {
    pathname: string;
    tabs: string[];
    tabpanelLinks: string[];
    headings: string[];
    snapshotExposesRowText: boolean | null;
};

export function urlOk(predicate: Record<string, unknown>, pathname: string, bindings: Bindings): ClauseResult | null {
    if (typeof predicate.url_path_equals === 'string') {
        const want = resolveTemplate(predicate.url_path_equals, bindings);
        return {desc: `url == ${want}`, ok: pathname === want};
    }
    if (typeof predicate.url_path_matches === 'string') {
        const pattern = resolveTemplate(predicate.url_path_matches, bindings);
        return {
            desc: `url ~ ${pattern}`,
            ok: new RegExp(pattern).test(pathname),
        };
    }
    return null;
}

/** Evaluates a UI checkpoint on the snapshot, with a scoped DOM text fallback; records which was used. */
export async function evalUiCheckpoint(
    page: Page,
    charter: JourneyCharter,
    cp: Record<string, unknown> & {id: string},
    bindings: Bindings,
    rawSnapshot: string,
    pathname: string,
): Promise<UiCheckpointResult> {
    const predicate = cp.predicate as Record<string, unknown>;
    const tree = parseSnapshot(rawSnapshot);
    const text = plainText(tree);
    const clauses: ClauseResult[] = [];
    const observation: string[] = [];

    // A UI predicate whose template is not bound yet (e.g. the thread id before the event fired)
    // counts as not-yet-true rather than throwing.
    try {
        const url = urlOk(predicate, pathname, bindings);
        if (url) {
            clauses.push(url);
        }
    } catch (error) {
        if (error instanceof Error && /Unbound charter template/.test(error.message)) {
            return {
                id: cp.id,
                ok: false,
                clauses: [
                    {
                        desc: 'url not evaluable yet (dependency unbound)',
                        ok: false,
                    },
                ],
                observation,
            };
        }
        throw error;
    }

    const snapshot = predicate.snapshot as {all?: Array<Record<string, unknown>>} | undefined;
    for (const clause of snapshot?.all ?? []) {
        try {
            if ('role' in clause && 'contains' in clause) {
                // tabpanel contains a link whose subtree text includes the target.
                const containerRole = clause.role as string;
                const inner = clause.contains as Record<string, unknown>;
                const innerName = resolveTemplate(inner.name as string, bindings);
                const containers = findNodes(tree, (n) => n.role === containerRole);
                let found = 0;
                let subtreeHas = false;
                for (const container of containers) {
                    for (const link of findNodes(
                        [container],
                        (n) => n.role === (inner.role as string) && n.name === innerName,
                    )) {
                        found++;
                        if (inner.subtree_text_contains) {
                            const want = resolveTemplate(inner.subtree_text_contains as string, bindings);
                            if (subtreeText(link).includes(want)) {
                                subtreeHas = true;
                            }
                        }
                    }
                }
                const countOk = found === (inner.count as number);
                let subtreeOk = true;
                let used = 'snapshot';
                if (inner.subtree_text_contains) {
                    const want = resolveTemplate(inner.subtree_text_contains as string, bindings);
                    if (subtreeHas) {
                        subtreeOk = true;
                    } else if (found > 0) {
                        // DOM fallback (only when the row exists but the aria snapshot didn't expose its child text).
                        const dom = await page
                            .getByRole(containerRole as 'tabpanel')
                            .getByRole(inner.role as 'link', {
                                name: innerName,
                                exact: true,
                            })
                            .first()
                            .textContent({timeout: 1500})
                            .catch(() => null);
                        subtreeOk = Boolean(dom && dom.includes(want));
                        used = 'dom';
                    } else {
                        subtreeOk = false;
                    }
                    observation.push(`${cp.id} row-text via ${used}`);
                }
                clauses.push({
                    desc: `${containerRole} contains ${inner.role} "${innerName}" x${inner.count} with subtree text`,
                    ok: countOk && subtreeOk,
                });
                continue;
            }
            if ('role' in clause) {
                const role = clause.role as string;
                const name = clause.name ? resolveTemplate(clause.name as string, bindings) : null;
                const nameContains = clause.name_contains as string | undefined;
                const level = clause.level as number | undefined;
                const selected = clause.selected as boolean | undefined;
                const matches = findNodes(tree, (n) => {
                    if (n.role !== role) {
                        return false;
                    }
                    if (name !== null && n.name !== name) {
                        return false;
                    }
                    if (nameContains && !(n.name ?? '').includes(nameContains)) {
                        return false;
                    }
                    if (level !== undefined && !n.line.includes(`[level=${level}]`)) {
                        return false;
                    }
                    if (selected === true && !n.line.includes('[selected]')) {
                        return false;
                    }
                    return true;
                });
                const want = (clause.count as number | undefined) ?? undefined;
                const atLeast = clause.count_at_least as number | undefined;
                const ok = want !== undefined ? matches.length === want : matches.length >= (atLeast ?? 1);
                clauses.push({
                    desc: `${role} "${name ?? nameContains}" count ${matches.length}`,
                    ok,
                });
                continue;
            }
            if ('text' in clause) {
                const want = resolveTemplate(clause.text as string, bindings);
                const n = occurrences(text, want);
                clauses.push({
                    desc: `text "${want}" x${n}`,
                    ok: n === (clause.count as number),
                });
                continue;
            }
            if ('text_contains' in clause) {
                const want = resolveTemplate(clause.text_contains as string, bindings);
                let n = occurrences(text, want);
                let used = 'snapshot';
                const atLeast = (clause.count_at_least as number | undefined) ?? 1;
                if (n < atLeast) {
                    const domCount = await page
                        .getByText(want)
                        .count()
                        .catch(() => 0);
                    n = Math.max(n, domCount);
                    used = 'dom';
                }
                observation.push(`${cp.id} "${want}" via ${used}`);
                clauses.push({
                    desc: `text_contains "${want}" x${n} (>= ${atLeast})`,
                    ok: n >= atLeast,
                });
                continue;
            }
        } catch (error) {
            if (error instanceof Error && /Unbound charter template/.test(error.message)) {
                clauses.push({
                    desc: 'clause not evaluable yet (dependency unbound)',
                    ok: false,
                });
                continue;
            }
            throw error;
        }
    }

    return {id: cp.id, ok: clauses.every((c) => c.ok), clauses, observation};
}

/** The live structure the charter asks to REPORT in any state whose path is the followed-thread view. */
export function threadsReport(
    rawSnapshot: string,
    pathname: string,
    bindings: Bindings,
    charter: JourneyCharter,
): ThreadsReport | null {
    const threadsPath = `/${bindings.team.name}/threads`;
    if (!pathname.startsWith(threadsPath)) {
        return null;
    }
    const tree = parseSnapshot(rawSnapshot);
    const tabs = findNodes(tree, (n) => n.role === 'tab').map(
        (n) => `tab "${n.name}"${n.line.includes('[selected]') ? ' [selected]' : ''}`,
    );
    const panels = findNodes(tree, (n) => n.role === 'tabpanel');
    const tabpanelLinks = panels.flatMap((p) =>
        findNodes([p], (n) => n.role === 'link').map((n) => `link "${n.name}"`),
    );
    const headings = findNodes(tree, (n) => n.role === 'heading').map(
        (n) => `heading "${n.name}"${/\[level=\d+\]/.exec(n.line)?.[0] ? ` ${/\[level=\d+\]/.exec(n.line)![0]}` : ''}`,
    );

    // Does the snapshot expose the row's child text under an aria-labelled link? Checked against the root string.
    let snapshotExposesRowText: boolean | null = null;
    const rootString = charter.fixture.fixed_strings?.root;
    if (rootString) {
        const links = panels.flatMap((p) => findNodes([p], (n) => n.role === 'link'));
        snapshotExposesRowText = links.length > 0 ? links.some((l) => subtreeText(l).includes(rootString)) : null;
    }
    return {pathname, tabs, tabpanelLinks, headings, snapshotExposesRowText};
}
