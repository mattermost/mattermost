// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';

import type {OracleHandle} from './attach.ts';

/**
 * MEASUREMENT SCRIPTS, NOT DISCOVERY. Each traversal is a fixed, hand-written Playwright script whose only
 * purpose is to give the oracles a repeatable stream of UI states on the seeded stack. Nothing here chooses
 * actions from observation, and nothing asserts product behaviour.
 */
export type Traversal = {
    id: string;
    title: string;
    run(t: TraversalContext): Promise<void>;
};

export type TraversalContext = {
    page: Page;
    oracles: OracleHandle;
    gotoChannel(name: string): Promise<void>;
    /** Seeding-admin REST helpers for the data-changing measurement scripts. */
    readChannel(name: string): Promise<Record<string, unknown>>;
    patchChannel(name: string, patch: Record<string, string>): Promise<void>;
    /** Ids of the posts currently in a channel, newest page only. */
    postIds(name: string): Promise<string[]>;
    /** Deletes posts of one type that were not in `keep`, so a data-changing script leaves no residue. */
    deletePostsExcept(name: string, type: string, keep: string[]): Promise<void>;
    /** Runs the O-MODAL Enter-while-disabled probe on the open dialog (Enter key only, nothing is typed). */
    probeEnterWhileDisabled(target: {
        dialog: Locator;
        confirm: Locator;
        field: Locator;
        submitPaths?: string[];
    }): Promise<void>;
};

const TEAM = 'qa-team';

async function step(t: TraversalContext, label: string, act: () => Promise<void>) {
    t.oracles.action(label);
    await act();
    await t.oracles.checkpoint();
}

async function loadChannel(t: TraversalContext, name: string) {
    await t.gotoChannel(name);
    await t.oracles.checkpoint();
}

async function clickSidebarChannel(t: TraversalContext, lowerName: string, slug: string) {
    await step(t, `click sidebar link "${lowerName} public channel"`, async () => {
        await t.page.getByRole('link', {name: `${lowerName} public channel`, exact: true}).click();
        await t.page.waitForURL(`**/${TEAM}/channels/${slug}`);
    });
}

async function openInfo(t: TraversalContext) {
    await step(t, 'click button "View Info"', async () => {
        await t.page.getByRole('button', {name: 'View Info', exact: true}).click();
        await t.page.getByRole('region', {name: 'Info', exact: true}).waitFor();
    });
}

async function closeInfo(t: TraversalContext) {
    await step(t, 'click button "Close Info"', async () => {
        await t.page.getByRole('button', {name: 'Close Info', exact: true}).click();
        await t.page.getByRole('region', {name: 'Info', exact: true}).waitFor({state: 'hidden'});
    });
}

async function openChannelMenu(t: TraversalContext, lowerName: string) {
    await step(t, `click button "${lowerName} channel menu"`, async () => {
        await t.page.getByRole('button', {name: `${lowerName} channel menu`, exact: true}).click();
        await t.page.getByRole('menu').first().waitFor();
    });
    await step(t, 'press Escape (close channel menu)', async () => {
        await t.page.keyboard.press('Escape');
        await t.page.getByRole('menu').first().waitFor({state: 'hidden'});
    });
}

export const TRAVERSALS: Traversal[] = [
    {
        id: 'T1-sidebar-channels',
        title: 'visit the sidebar channels',
        async run(t) {
            await loadChannel(t, 'qa-sandbox');
            await clickSidebarChannel(t, 'release planning', 'release-planning');
            await clickSidebarChannel(t, 'qa sandbox', 'qa-sandbox');
            await clickSidebarChannel(t, 'off-topic', 'off-topic');
            await clickSidebarChannel(t, 'town square', 'town-square');
            await step(t, 'navigate to the archived channel by URL', async () => {
                await t.gotoChannel('legacy-roadmap');
            });
            await clickSidebarChannel(t, 'qa sandbox', 'qa-sandbox');
        },
    },
    {
        id: 'T2-info-panel',
        title: 'open and close the Info panel',
        async run(t) {
            await loadChannel(t, 'qa-sandbox');
            await openInfo(t);
            await closeInfo(t);
            await clickSidebarChannel(t, 'release planning', 'release-planning');
            await openInfo(t);
            await closeInfo(t);
            await step(t, 'navigate to the archived channel by URL', async () => {
                await t.gotoChannel('legacy-roadmap');
            });
            await openInfo(t);
            await closeInfo(t);
        },
    },
    {
        id: 'T3-channel-menu',
        title: 'open the channel menu',
        async run(t) {
            await loadChannel(t, 'qa-sandbox');
            await openChannelMenu(t, 'qa sandbox');
            await clickSidebarChannel(t, 'release planning', 'release-planning');
            await openChannelMenu(t, 'release planning');
        },
    },
    {
        id: 'T4-threads',
        title: 'open Threads',
        async run(t) {
            await loadChannel(t, 'qa-sandbox');
            await step(t, 'click sidebar link "Threads"', async () => {
                await t.page.getByRole('link', {name: 'Threads', exact: true}).click();
                await t.page.waitForURL(`**/${TEAM}/threads`);
            });
            await clickSidebarChannel(t, 'qa sandbox', 'qa-sandbox');
        },
    },
    {
        id: 'T5-drafts',
        title: 'open Drafts',
        async run(t) {
            await loadChannel(t, 'qa-sandbox');
            const link = t.page.getByRole('link', {name: /^Drafts/});
            const viaSidebar = (await link.count()) > 0;
            await step(t, viaSidebar ? 'click sidebar link "Drafts"' : 'navigate to Drafts by URL', async () => {
                if (viaSidebar) {
                    await link.first().click();
                } else {
                    await t.page.goto(`/${TEAM}/drafts`);
                }
                await t.page.waitForURL(`**/${TEAM}/drafts`);
                await t.page.getByRole('application', {name: 'channel sidebar region'}).waitFor();
            });
            await clickSidebarChannel(t, 'qa sandbox', 'qa-sandbox');
        },
    },
];

const HEADER_MARKER = 'Measurement header marker';

/** Data-changing measurement script used by the WebSocket faults: the UI must follow a REST change. */
export const HEADER_UPDATE_TRAVERSAL: Traversal = {
    id: 'W-header-update',
    title: 'an admin changes a channel header through REST while the Info panel is open',
    async run(t) {
        await loadChannel(t, 'qa-sandbox');
        await openInfo(t);
        const original = String((await t.readChannel('qa-sandbox')).header ?? '');
        const postsBefore = await t.postIds('qa-sandbox');
        try {
            await step(t, 'admin changes the channel header through REST', async () => {
                await t.patchChannel('qa-sandbox', {header: HEADER_MARKER});
            });
        } finally {
            await step(t, 'admin restores the channel header through REST', async () => {
                await t.patchChannel('qa-sandbox', {header: original});
            });
            await t.deletePostsExcept('qa-sandbox', 'system_header_change', postsBefore);
        }
    },
};

export function findTraversal(id: string): Traversal {
    const found = [...TRAVERSALS, ...EXTRA_TRAVERSALS, HEADER_UPDATE_TRAVERSAL].find((t) => t.id === id);
    if (!found) {
        throw new Error(`unknown traversal ${id}`);
    }
    return found;
}

/** Extra live probe, kept out of the five-traversal false-positive table: the modal oracle on a real dialog. */
export const MODAL_PROBE_TRAVERSAL: Traversal = {
    id: 'X1-create-channel-dialog-enter',
    title: 'open the Create-channel dialog and press Enter in the empty name field (no typing)',
    async run(t) {
        await loadChannel(t, 'qa-sandbox');
        await step(t, 'click button "Browse or create channels"', async () => {
            await t.page.getByRole('button', {name: 'Browse or create channels'}).click();
            await t.page.getByRole('menuitem', {name: /Create new channel/}).waitFor();
        });
        const dialog = t.page.getByRole('dialog', {name: 'Create a new channel'});
        await step(t, 'click menu item "Create new channel"', async () => {
            await t.page.getByRole('menuitem', {name: /Create new channel/}).click();
            await dialog.waitFor();
        });
        await step(t, 'press Enter in the empty "Channel name" field while "Create channel" is disabled', async () => {
            await t.probeEnterWhileDisabled({
                dialog,
                confirm: dialog.getByRole('button', {name: 'Create channel', exact: true}),
                field: dialog.getByRole('textbox', {name: 'Channel name'}),
                submitPaths: ['/api/v4/channels'],
            });
        });
        await step(t, 'press Escape (close the dialog)', async () => {
            await t.page.keyboard.press('Escape');
            await dialog.waitFor({state: 'hidden'});
        });
    },
};
export const EXTRA_TRAVERSALS: Traversal[] = [MODAL_PROBE_TRAVERSAL];
