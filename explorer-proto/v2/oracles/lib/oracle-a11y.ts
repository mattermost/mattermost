// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {INTERACTIVE_ROLES, parseSnapshot} from '../../../src/snapshot.ts';
import type {SnapNode} from '../../../src/snapshot.ts';

import type {FindingInput} from './findings.ts';
import {pagePath} from './oracle-events.ts';

export type DomRefIssue = {
    attr: string;
    missing: string[];
    tag: string;
    role: string;
    testid: string;
    id: string;
    within: string;
};

const NAMED_CONTEXT_ROLES = new Set([
    'application',
    'banner',
    'complementary',
    'dialog',
    'alertdialog',
    'form',
    'main',
    'navigation',
    'region',
    'search',
]);
// A page may legitimately have several of these unnamed only if they are not landmarks; for these roles
// two instances with the same (possibly empty) name cannot be told apart by a screen-reader user.
const LANDMARK_ROLES = new Set([
    'banner',
    'complementary',
    'contentinfo',
    'form',
    'main',
    'navigation',
    'region',
    'search',
]);
const UNNAMED_LANDMARK_OK_ROLES = new Set(['form', 'region']);

/** Two snapshots a short interval apart must agree, so a mid-render frame is not judged. */
export async function stableSnapshot(page: Page, attempts = 6, intervalMs = 120): Promise<string> {
    let previous = await page.locator('body').ariaSnapshot();
    for (let i = 0; i < attempts; i++) {
        await page.waitForTimeout(intervalMs);
        const next = await page.locator('body').ariaSnapshot();
        if (next === previous) {
            return next;
        }
        previous = next;
    }
    return previous;
}

/** Runs in the page: aria-labelledby / aria-describedby ids that do not exist in the document. */
export function collectDomRefIssues(page: Page): Promise<DomRefIssue[]> {
    return page.evaluate(() => {
        const issues: DomRefIssue[] = [];
        const describe = (el: Element) => {
            const parent = el.parentElement?.closest('[data-testid], [id], [role]');
            return parent
                ? `${parent.tagName.toLowerCase()}${parent.id ? `#${parent.id}` : ''}${
                      parent.getAttribute('data-testid') ? `[data-testid=${parent.getAttribute('data-testid')}]` : ''
                  }${parent.getAttribute('role') ? `[role=${parent.getAttribute('role')}]` : ''}`
                : 'document';
        };
        for (const attr of ['aria-labelledby', 'aria-describedby']) {
            for (const el of Array.from(document.querySelectorAll(`[${attr}]`))) {
                const ids = (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean);
                const missing = ids.filter((id) => !document.getElementById(id));
                const visible = Boolean(
                    (el as HTMLElement).offsetWidth || (el as HTMLElement).offsetHeight || el.getClientRects().length,
                );
                if (missing.length > 0 && visible) {
                    issues.push({
                        attr,
                        missing,
                        tag: el.tagName.toLowerCase(),
                        role: el.getAttribute('role') ?? '',
                        testid: el.getAttribute('data-testid') ?? '',
                        id: el.id,
                        within: describe(el),
                    });
                }
            }
        }
        return issues;
    });
}

function contextOf(ancestors: SnapNode[]): string {
    const named = ancestors.filter((n) => NAMED_CONTEXT_ROLES.has(n.role) && n.name !== null).slice(-2);
    return named.length > 0 ? ` in ${named.map((n) => `${n.role} "${n.name}"`).join(' > ')}` : '';
}

function childRoles(node: SnapNode): string {
    const roles = node.children.map((c) => c.role).filter((r) => r !== '/url' && r !== 'text');
    return roles.length > 0 ? ` [children: ${[...new Set(roles)].slice(0, 3).join(', ')}]` : '';
}

function linkTarget(node: SnapNode): string {
    const url = node.children.find((c) => c.role === '/url');
    const match = url ? /^\/url:\s*"?([^"]*)"?$/.exec(url.line) : null;
    return match ? ` -> ${match[1]}` : '';
}

/** Pure: accessibility-snapshot text structure checks (empty names, duplicate landmarks, unnamed dialogs). */
export function snapshotIssues(snapshot: string): Array<{class: string; evidence: string}> {
    const issues: Array<{class: string; evidence: string}> = [];
    const landmarks = new Map<string, {role: string; name: string | null; count: number}>();

    const visit = (nodes: SnapNode[], ancestors: SnapNode[]) => {
        for (const node of nodes) {
            const empty = node.name === null || node.name.trim() === '';
            if (INTERACTIVE_ROLES.has(node.role) && empty) {
                issues.push({
                    class: 'empty-accessible-name',
                    evidence: `${node.role} has an empty accessible name${linkTarget(node)}${childRoles(node)}${contextOf(ancestors)}`,
                });
            }
            if ((node.role === 'dialog' || node.role === 'alertdialog') && empty) {
                const heading = node.children.find((c) => c.role === 'heading' && c.name);
                issues.push({
                    class: 'dialog-without-name',
                    evidence: `${node.role} has no accessible name${heading ? ` (first heading "${heading.name}")` : ''}${contextOf(ancestors)}`,
                });
            }
            if (LANDMARK_ROLES.has(node.role) && !(UNNAMED_LANDMARK_OK_ROLES.has(node.role) && empty)) {
                const key = JSON.stringify([node.role, empty ? null : node.name]);
                const entry = landmarks.get(key) ?? {role: node.role, name: empty ? null : node.name, count: 0};
                entry.count++;
                landmarks.set(key, entry);
            }
            visit(node.children, [...ancestors, node]);
        }
    };
    visit(parseSnapshot(snapshot), []);

    for (const entry of landmarks.values()) {
        if (entry.count > 1) {
            issues.push({
                class: 'duplicate-landmark',
                evidence: `${entry.count} ${entry.role} landmarks share the ${entry.name === null ? 'empty name' : `name "${entry.name}"`}`,
            });
        }
    }
    return issues;
}

export function domRefInputs(issues: DomRefIssue[], page: string, action: number): FindingInput[] {
    return issues.flatMap((issue) =>
        issue.missing.map((id) => ({
            oracle: 'O-A11Y',
            class: 'dangling-aria-reference',
            path: page,
            evidence: `${issue.attr} on <${issue.tag}${issue.role ? ` role=${issue.role}` : ''}${
                issue.testid ? ` data-testid=${issue.testid}` : ''
            }${issue.id ? ` id=${issue.id}` : ''}> references missing id "${id}" (inside ${issue.within})`,
            action,
        })),
    );
}

export type A11yResult = {snapshotLines: number};

/** O-A11Y: one checkpoint. Findings are counted once per checkpoint at which the state is observed. */
export async function runA11yOracle(
    page: Page,
    add: (input: FindingInput) => void,
    action: number,
): Promise<A11yResult> {
    const snapshot = await stableSnapshot(page);
    const where = pagePath(page);
    const inputs = [
        ...snapshotIssues(snapshot).map((issue) => ({
            oracle: 'O-A11Y',
            class: issue.class,
            path: where,
            evidence: issue.evidence,
            action,
        })),
        ...domRefInputs(await collectDomRefIssues(page), where, action),
    ];
    for (const input of inputs) {
        add({...input, perCheckpoint: true});
    }
    return {snapshotLines: snapshot.split('\n').length};
}
