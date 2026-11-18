// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {openSystemConsoleSection, expect, test, getAdminClient} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

// Teams here are created on the shared admin account, so track and delete them instead of letting
// them inflate the team list of every later spec in the run.
const createdTeamIds: string[] = [];

async function initSetupTracked(pw: PlaywrightExtended) {
    const setup = await pw.initSetup();
    createdTeamIds.push(setup.team.id);
    return setup;
}

test.afterEach(async () => {
    const {adminClient} = await getAdminClient();
    await Promise.allSettled(createdTeamIds.splice(0).map((id) => adminClient.deleteTeam(id)));
});

/**
 * @objective Verify the Switch teams submenu is not clipped by the fixed-width sidebar, so the
 * scroll bar it renders when the team list overflows stays visible and reachable.
 */
test(
    'does not clip the Switch teams submenu scroll bar when the team list overflows',
    {tag: '@system_console'},
    async ({pw}) => {
        const {adminUser, adminClient} = await initSetupTracked(pw);

        // # Give the admin enough teams for the Switch teams submenu to overflow
        await Promise.all(
            Array.from({length: 30}, async () => {
                const team = await adminClient.createTeam(await pw.random.team());
                createdTeamIds.push(team.id);
            }),
        );

        // # Open the System Console as the admin
        const {app} = await pw.testBrowser.login(adminUser);
        await openSystemConsoleSection(app);
        const {sidebar} = app.admin;

        // # Open the header menu, then the Switch teams submenu
        await sidebar.header.menu.container.clickTo(sidebar.header.menu.switchTeamsMenuItem);
        const headerMenu = sidebar.header.menu;
        await headerMenu.switchTeamsMenuItem.hover();
        const menu = headerMenu.switchTeamsMenu.paper.locator;
        await expect(menu).toBeVisible();

        // * Verify the team list is long enough for the submenu paper to scroll
        const verticalOverflow = await menu.evaluate((el: HTMLElement) => el.scrollHeight - el.clientHeight);
        expect(
            verticalOverflow,
            'the Switch teams submenu should have more entries than fit, so that it renders a scroll bar',
        ).toBeGreaterThan(0);

        // * Verify the submenu extends past the sidebar column, which is what put its scroll bar inside
        // the region the sidebar clips
        const menuRight = await menu.evaluate((el: HTMLElement) => el.getBoundingClientRect().right);
        const sidebarRight = await sidebar.locator.evaluate((el: HTMLElement) => el.getBoundingClientRect().right);
        expect(
            menuRight,
            'the Switch teams submenu should extend past the sidebar column it opens from',
        ).toBeGreaterThan(sidebarRight);

        // * Verify the strip just inside the paper's right border, where the scroll bar is drawn, still
        // hit-tests back to the submenu rather than to whatever the sidebar clips it down to. Headless
        // Chromium runs with --hide-scrollbars, so probe that strip rather than measure its width.
        await expect
            .poll(
                async () =>
                    menu.evaluate((el: HTMLElement) => {
                        const rect = el.getBoundingClientRect();
                        const borderRight = parseFloat(getComputedStyle(el).borderRightWidth);
                        const hit = document.elementFromPoint(rect.right - borderRight - 1, rect.top + rect.height / 2);

                        if (el.contains(hit)) {
                            return 'the menu';
                        }
                        return hit ? `${hit.tagName.toLowerCase()}.${hit.getAttribute('class')}` : 'nothing';
                    }),
                {message: 'the submenu scroll bar strip should not be clipped away by the sidebar'},
            )
            .toBe('the menu');

        // # Scroll the submenu with the wheel
        await menu.hover();
        await expect(menu).toBeVisible();
        await app.page.mouse.wheel(0, 200);

        // * Verify the submenu scrolled
        await expect.poll(async () => menu.evaluate((el: HTMLElement) => el.scrollTop)).toBeGreaterThan(0);
    },
);

/**
 * @objective Verify the System Console sidebar itself still cannot be scrolled, so that letting the
 * header menu overflow it horizontally does not bring back the scrollable sidebar.
 */
test('keeps the System Console sidebar itself unscrollable', {tag: '@system_console'}, async ({pw}) => {
    const {adminUser} = await initSetupTracked(pw);

    // # Open the System Console as the admin
    const {app} = await pw.testBrowser.login(adminUser);
    await openSystemConsoleSection(app);
    await expect(app.admin.sidebar).toBeVisible();

    // # Try to scroll the sidebar in both directions
    const sidebarScroll = await app.admin.sidebar.locator.evaluate((el: HTMLElement) => {
        el.scrollTop = 9999;
        el.scrollLeft = 9999;

        return {
            hasMoreContentThanFits: el.scrollHeight > el.clientHeight,
            scrollTop: el.scrollTop,
            scrollLeft: el.scrollLeft,
        };
    });

    // * Verify the sidebar has more content than fits, so that it would scroll if it were allowed to
    expect(
        sidebarScroll.hasMoreContentThanFits,
        'the sidebar should have more sections than fit, otherwise the scroll assertion is vacuous',
    ).toBe(true);

    // * Verify the sidebar stayed put
    expect({scrollTop: sidebarScroll.scrollTop, scrollLeft: sidebarScroll.scrollLeft}).toEqual({
        scrollTop: 0,
        scrollLeft: 0,
    });
});
