// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Run by survey_names.mjs (never directly). Read-only measurement, not exploration: loads one fixed channel as the
// seeded member and records the accessible names of a few control groups. Only names are written, never ids or URLs.
import fs from 'node:fs';
import path from 'node:path';

import {test} from '@mattermost/playwright-lib';
import type {Page} from '@playwright/test';

import {settle} from '../../src/bfs.ts';
import {compareStrings, normalizeSnapshot, parseSnapshot, printable, walk} from '../../src/snapshot.ts';
import type {SnapNode} from '../../src/snapshot.ts';
import {closeGuardedSessions, openGuardedSession} from '../../src/session.ts';

const CHANNEL_PATH = '/qa-team/channels/qa-sandbox';
const LANDMARKS = new Set(['application', 'banner', 'complementary', 'dialog', 'form', 'main', 'navigation', 'region']);
const CONTROL_ROLES = new Set(['button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab']);
const OUT_DIR = path.resolve(__dirname, '..', '.run', 'survey');

test.afterEach(closeGuardedSessions);

const label = (node: SnapNode) => `${node.role} "${printable(node.name ?? '')}"`;
const sorted = (values: Iterable<string>) => [...new Set(values)].sort(compareStrings);

function descendants(node: SnapNode): SnapNode[] {
    const out: SnapNode[] = [];
    walk(node.children, (n) => out.push(n));
    return out;
}

function controls(nodes: SnapNode[], roles: Set<string> = CONTROL_ROLES): string[] {
    return sorted(nodes.filter((n) => roles.has(n.role) && n.name !== null).map(label));
}

function urlOf(node: SnapNode): string {
    return (
        node.children
            .find((c) => c.line.startsWith('/url:'))
            ?.line.slice('/url:'.length)
            .trim() ?? ''
    );
}

async function snapshot(page: Page): Promise<SnapNode[]> {
    const observed = await settle(page);
    return parseSnapshot(normalizeSnapshot(observed.raw));
}

const named = (nodes: SnapNode[], role: string, pattern: RegExp) =>
    nodes.filter((n) => n.role === role && pattern.test(n.name ?? ''));

/** Everything the closed-state page shows for the five requested control groups. */
function closedState(roots: SnapNode[]) {
    const everything = roots.flatMap((r) => [r, ...descendants(r)]);
    const header = roots.find((r) => r.role === 'banner' && /channel header/i.test(r.name ?? ''));
    const headerNodes = header ? descendants(header) : [];

    const sidebarLinks = roots
        .filter((r) => LANDMARKS.has(r.role) && !['main', 'banner', 'dialog'].includes(r.role))
        .flatMap(descendants)
        .filter((n) => n.role === 'link' && /^\/[^/]+\/(channels\/|threads)/.test(urlOf(n)));

    const headerIndex = header ? roots.indexOf(header) : -1;
    const mainIndex = roots.findIndex((r) => r.role === 'main');
    const betweenHeaderAndMain =
        headerIndex >= 0 && mainIndex > headerIndex ? roots.slice(headerIndex + 1, mainIndex) : [];
    const bookmarkScope = [
        ...betweenHeaderAndMain.flatMap((r) => [r, ...descendants(r)]),
        ...everything.filter((n) => LANDMARKS.has(n.role) && /bookmark/i.test(n.name ?? '')).flatMap(descendants),
    ];

    return {
        landmarks: sorted(everything.filter((n) => LANDMARKS.has(n.role) && n.name !== null).map(label)),
        sidebar_links: controls(sidebarLinks, new Set(['link'])),
        channel_header_buttons: controls(headerNodes, new Set(['button'])),
        info_toggle_closed: controls(named(headerNodes, 'button', /info/i), new Set(['button'])),
        favorite_controls: controls(everything.filter((n) => /favorit|\bstar\b|starred/i.test(n.name ?? ''))),
        bookmark_links: controls(bookmarkScope, new Set(['link'])),
        bookmark_controls: controls(
            bookmarkScope.filter((n) => /bookmark/i.test(n.name ?? '')),
            new Set(['button', 'menuitem']),
        ),
    };
}

async function pressByName(page: Page, entry: string): Promise<boolean> {
    const name = entry.replace(/^button "/, '').replace(/"$/, '');
    const button = page.getByRole('button', {name: name.replace(/\\u\{[0-9a-f]+\}/g, ''), exact: false}).first();
    if ((await button.count()) === 0) {
        return false;
    }
    await button.click();
    return true;
}

test('survey accessible names of the channel page', async ({pw}) => {
    test.setTimeout(3 * 60_000);
    const surveyLabel = process.env.SURVEY_LABEL ?? '';
    if (!/^[a-z0-9.-]{1,40}$/.test(surveyLabel)) {
        throw new Error('SURVEY_LABEL must be a short lowercase label (set by survey_names.mjs run --label=...).');
    }

    const {page} = await openGuardedSession(pw, 'exploration');
    await page.goto(CHANNEL_PATH);
    const closed = closedState(await snapshot(page));

    const result: Record<string, unknown> = {schema: 'explorer-name-survey/v1', label: surveyLabel, ...closed};

    const infoButton = closed.info_toggle_closed[0];
    if (infoButton && (await pressByName(page, infoButton))) {
        const roots = await snapshot(page);
        const everything = roots.flatMap((r) => [r, ...descendants(r)]);
        const header = roots.find((r) => r.role === 'banner' && /channel header/i.test(r.name ?? ''));
        const panels = everything.filter((n) => LANDMARKS.has(n.role) && /info/i.test(n.name ?? ''));
        result.info_toggle_open = controls(
            named(header ? descendants(header) : [], 'button', /info/i),
            new Set(['button']),
        );
        result.info_panel_landmarks = sorted(panels.map(label));
        result.info_panel_controls = controls(panels.flatMap(descendants));
        await pressByName(page, (result.info_toggle_open as string[])[0] ?? infoButton);
        await settle(page);
    } else {
        result.info_toggle_open = [];
        result.info_panel_landmarks = [];
        result.info_panel_controls = [];
    }

    const menuButton = closed.channel_header_buttons.find((b) => /channel menu"$/.test(b));
    if (menuButton && (await pressByName(page, menuButton))) {
        const roots = await snapshot(page);
        const menus = roots.flatMap((r) => [r, ...descendants(r)]).filter((n) => n.role === 'menu');
        result.channel_menu_items = controls(menus.flatMap(descendants));
        await page.keyboard.press('Escape');
    } else {
        result.channel_menu_items = [];
    }

    fs.mkdirSync(OUT_DIR, {recursive: true});
    fs.writeFileSync(path.join(OUT_DIR, `${surveyLabel}.json`), `${JSON.stringify(result, null, 2)}\n`);
});
