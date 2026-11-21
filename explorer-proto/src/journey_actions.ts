// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import type {JourneyCharter} from './journey_charter.ts';
import {compareRoleName, parseSnapshot} from './snapshot.ts';
import type {RoleName, SnapNode} from './snapshot.ts';

export type SkippedCandidate = RoleName & {reason: string};

export type Enumeration = {
    candidates: RoleName[];
    skipped: SkippedCandidate[];
    modalOpen: boolean;
    menuOpen: boolean;
    regions: string[];
    unidentifiedLandmarks: string[];
};

export const ESCAPE: RoleName = {role: 'key', name: 'Escape'};

/**
 * Region mapping (generic, documented in README-engine.md). Only the two charter-excluded regions are
 * positively identified from landmarks; every other subtree counts as in play. A landmark we cannot
 * map is reported and treated conservatively (its subtree stays in play, but it is logged).
 *
 * Mapping is by landmark role and accessible name (v12.1.0 uses role "application" for several regions):
 * - dialog / alertdialog                         -> modal (in play; modal_policy scopes to the topmost)
 * - name contains "message input" / "composer"   -> message composer (EXCLUDED)
 * - role form                                     -> messaging-help form, composer chrome (EXCLUDED)
 * - banner with a name containing "channel header"-> channel header (in play)
 * - banner without that name                      -> global header (EXCLUDED)
 * - name contains "channel sidebar"/"channel navigator" -> left sidebar (in play)
 * - role main                                     -> center pane (in play)
 * A landmark that matches none of these is reported and kept in play (conservative).
 */
function regionForLandmark(node: SnapNode): {region: string; excluded: boolean} | null {
    const name = (node.name ?? '').toLowerCase();
    if (node.role === 'dialog' || node.role === 'alertdialog') {
        return {region: 'modal', excluded: false};
    }
    if (name.includes('message input') || name.includes('composer')) {
        return {region: 'composer', excluded: true};
    }
    if (node.role === 'form') {
        return {region: 'form', excluded: true};
    }
    if (node.role === 'banner') {
        return name.includes('channel header')
            ? {region: 'channel header', excluded: false}
            : {region: 'global header', excluded: true};
    }
    if (name.includes('channel sidebar') || name.includes('channel navigator')) {
        return {region: 'left sidebar', excluded: false};
    }
    if (node.role === 'main') {
        return {region: 'center', excluded: false};
    }
    return null;
}

const LANDMARK_ROLES = new Set([
    'banner',
    'complementary',
    'form',
    'dialog',
    'alertdialog',
    'navigation',
    'main',
    'region',
    'application',
    'contentinfo',
    'search',
]);

type Collected = RoleName & {
    excluded: boolean;
    region: string;
    href: string | null;
};

/** Href from a link node's `/url:` child, if any (origin already replaced with <origin> in the snapshot). */
function hrefOf(node: SnapNode): string | null {
    for (const c of node.children) {
        const m = /^\/url:\s*"?([^"]*)"?\s*$/.exec(c.line);
        if (m) {
            return m[1];
        }
    }
    return null;
}

function collect(
    nodes: SnapNode[],
    inherited: {excluded: boolean; region: string},
    insideDialog: boolean,
    onlyDialogSubtree: boolean,
    out: Collected[],
    regions: Set<string>,
    unidentified: Set<string>,
) {
    for (const node of nodes) {
        let ctx = inherited;
        let childInsideDialog = insideDialog;
        if (LANDMARK_ROLES.has(node.role)) {
            const mapped = regionForLandmark(node);
            if (mapped) {
                ctx = {
                    excluded: inherited.excluded || mapped.excluded,
                    region: mapped.region,
                };
                regions.add(mapped.region);
                if (mapped.region === 'modal') {
                    childInsideDialog = true;
                }
            } else if (node.name !== null) {
                unidentified.add(`${node.role} "${node.name}"`);
            }
        }
        const visibleHere = !onlyDialogSubtree || childInsideDialog;
        if (node.name !== null && node.role !== 'text' && visibleHere) {
            out.push({
                role: node.role,
                name: node.name,
                excluded: ctx.excluded,
                region: ctx.region,
                href: hrefOf(node),
            });
        }
        collect(node.children, ctx, childInsideDialog, onlyDialogSubtree, out, regions, unidentified);
    }
}

function hasRole(nodes: SnapNode[], role: string): boolean {
    for (const n of nodes) {
        if (n.role === role) {
            return true;
        }
        if (hasRole(n.children, role)) {
            return true;
        }
    }
    return false;
}

/**
 * Enumerates candidate actions from the live accessibility snapshot using charter.action_rules only.
 * Every skipped item is recorded with the rule that skipped it.
 */
export async function enumerateCandidates(
    page: Page,
    rawSnapshot: string,
    charter: JourneyCharter,
): Promise<Enumeration> {
    const rules = charter.action_rules as Record<string, unknown>;
    const rolesInPlay = new Set(rules.roles_in_play as string[]);
    const patterns = (
        (
            rules.excluded_name_patterns as {
                patterns?: Array<{pattern: string}>;
            }
        )?.patterns ?? []
    ).map((p) => new RegExp(p.pattern, 'i'));

    const tree = parseSnapshot(rawSnapshot);
    const modalOpen = hasRole(tree, 'dialog') || hasRole(tree, 'alertdialog');
    const menuOpen = hasRole(tree, 'menu');

    const collected: Collected[] = [];
    const regions = new Set<string>();
    const unidentified = new Set<string>();
    collect(tree, {excluded: false, region: 'root'}, false, modalOpen, collected, regions, unidentified);

    // Count occurrences per (role, name) in the snapshot to flag ambiguity early.
    const counts = new Map<string, number>();
    for (const c of collected) {
        const key = JSON.stringify([c.role, c.name]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const seen = new Set<string>();
    const candidates: RoleName[] = [];
    const skipped: SkippedCandidate[] = [];
    const dialogScope = modalOpen ? page.getByRole('dialog').last() : null;

    for (const c of collected) {
        const key = JSON.stringify([c.role, c.name]);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        const rn: RoleName = {role: c.role, name: c.name};

        if (!rolesInPlay.has(c.role)) {
            continue; // Not an actuable role; not reported as a skip to keep the log focused on in-play roles.
        }
        if (c.excluded) {
            skipped.push({...rn, reason: `excluded region (${c.region})`});
            continue;
        }
        const matched = patterns.find((p) => p.test(c.name));
        if (matched) {
            skipped.push({
                ...rn,
                reason: `excluded name pattern ${matched.source}`,
            });
            continue;
        }
        if (c.role === 'link' && c.href && /^https?:/i.test(c.href) && !c.href.startsWith('<origin>')) {
            skipped.push({...rn, reason: 'origin rule: off-origin href'});
            continue;
        }

        const locator = (dialogScope ?? page).getByRole(c.role as 'button', {
            name: c.name,
            exact: true,
        });
        const count = await locator.count();
        if (count !== 1) {
            skipped.push({
                ...rn,
                reason: `uniqueness: ${count} visible matches${modalOpen ? ' in topmost dialog' : ''}`,
            });
            continue;
        }
        if (!(await locator.isEnabled().catch(() => false)) || !(await locator.isVisible().catch(() => false))) {
            skipped.push({
                ...rn,
                reason: 'uniqueness: element not visible+enabled at click time',
            });
            continue;
        }
        candidates.push(rn);
    }

    // key_actions: Escape only, offered when a dialog or menu is open to allow dismissal.
    if (modalOpen || menuOpen) {
        candidates.push(ESCAPE);
    }

    return {
        candidates: candidates.sort(compareRoleName),
        skipped: skipped.sort(compareRoleName),
        modalOpen,
        menuOpen,
        regions: [...regions].sort(),
        unidentifiedLandmarks: [...unidentified].sort(),
    };
}
