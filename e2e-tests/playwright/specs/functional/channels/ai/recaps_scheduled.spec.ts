// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createUnreadChannelFixture, setupRecapBridge} from './recaps_helpers';

const MONDAY = 1 << 1;
const WEDNESDAY = 1 << 3;

/**
 * @objective Verify a user can create, list, pause, and resume a scheduled AI recap
 */
test('creates and manages a scheduled recap', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Scheduled recap ${pw.random.id()}`;
    const sourceMessage = `Scheduled recap source ${pw.random.id()}`;

    // # Initialize the test server state, configure a deterministic recap agent, and seed a channel.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Scheduled recap channel',
        sourceMessage,
    );

    // # Create a selected-channel scheduled recap through the modal flow.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const createRecapModal = await recapsPage.openCreateRecap();
    await createRecapModal.fillTitle(recapTitle);
    await createRecapModal.selectSelectedChannels();
    await createRecapModal.clickNext();
    await createRecapModal.expectChannelSelectorVisible();
    await createRecapModal.searchChannel(channel.display_name);
    await createRecapModal.selectChannel(channel.display_name);
    await createRecapModal.clickNext();
    await createRecapModal.expectScheduleConfigurationVisible();
    await createRecapModal.selectScheduleDay('M');
    await createRecapModal.createSchedule();

    // * Verify the scheduled recap is listed with stable schedule structure and active state.
    await recapsPage.toBeVisible();
    await recapsPage.switchToScheduled();

    const scheduledRecap = recapsPage.getScheduledRecap(recapTitle);
    await scheduledRecap.toBeVisible();
    await scheduledRecap.expectSchedulePattern(/Mon|Monday/);
    await scheduledRecap.expectSchedulePattern(/ at /);
    await scheduledRecap.expectActive();

    // * Verify pause and resume update both the UI and the stored scheduled recap.
    await scheduledRecap.pause();
    await scheduledRecap.resume();

    const scheduledRecaps = await userClient.getScheduledRecaps(0, 60);
    const createdRecap = scheduledRecaps.find((recap) => recap.title === recapTitle);
    expect(createdRecap).toBeDefined();
    expect(createdRecap?.agent_id).toBe(agent.id);
    expect(createdRecap?.channel_ids).toContain(channel.id);
    expect(createdRecap?.days_of_week).toBe(MONDAY);
    expect(createdRecap?.enabled).toBe(true);
});

/**
 * @objective Verify the scheduled recap limit rejects creating more active scheduled recaps than configured
 */
test('rejects scheduled recap creation after the active schedule limit', {tag: '@ai_recaps'}, async ({pw}) => {
    const titlePrefix = `Limited scheduled recap ${pw.random.id()}`;
    const sourceMessage = `Scheduled limit source ${pw.random.id()}`;

    // # Initialize an isolated user, configure the recap bridge, and set a one-scheduled-recap limit.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [],
    });
    const originalConfig = await adminClient.getConfig();

    try {
        await adminClient.patchConfig({
            AIRecapSettings: {
                EnforceScheduledRecaps: true,
                DefaultLimits: {
                    MaxScheduledRecaps: 1,
                },
            },
        });

        const channel = await createUnreadChannelFixture(
            pw,
            adminClient,
            adminUser.id,
            user.id,
            team.id,
            'Scheduled limit recap channel',
            sourceMessage,
        );
        const scheduledRecapInput = {
            days_of_week: WEDNESDAY,
            time_of_day: '09:00',
            timezone: 'UTC',
            time_period: 'last_24h' as const,
            channel_mode: 'specific' as const,
            channel_ids: [channel.id],
            agent_id: agent.id,
            is_recurring: true,
        };

        const allowedRecap = await userClient.createScheduledRecap({
            ...scheduledRecapInput,
            title: `${titlePrefix} allowed`,
        });

        let blockedError: {status_code?: number; message?: string} | undefined;
        try {
            await userClient.createScheduledRecap({
                ...scheduledRecapInput,
                title: `${titlePrefix} blocked`,
            });
        } catch (error) {
            blockedError = error as {status_code?: number; message?: string};
        }

        // * Verify the API rejects the over-limit schedule without creating the second recap.
        expect(blockedError?.status_code).toBe(400);
        expect(blockedError?.message).toContain('scheduled recaps');

        const scheduledRecaps = await userClient.getScheduledRecaps(0, 60);
        expect(scheduledRecaps.some((recap) => recap.id === allowedRecap.id)).toBe(true);
        expect(scheduledRecaps.some((recap) => recap.title === `${titlePrefix} blocked`)).toBe(false);
    } finally {
        await adminClient.updateConfig(originalConfig as any);
    }
});

/**
 * @objective Verify a user can edit a scheduled recap's title and schedule days through the Options menu
 */
test('edits a scheduled recap through the options menu', {tag: '@ai_recaps'}, async ({pw}) => {
    const originalTitle = `Editable scheduled recap ${pw.random.id()}`;
    const updatedTitle = `Edited scheduled recap ${pw.random.id()}`;
    const sourceMessage = `Edit scheduled source ${pw.random.id()}`;

    // # Initialize the test server state, configure the recap bridge, and seed a channel.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Edit scheduled recap channel',
        sourceMessage,
    );

    // # Create a Monday-only scheduled recap through the API so the edit flow starts from a known state.
    const createdRecap = await userClient.createScheduledRecap({
        title: originalTitle,
        days_of_week: MONDAY,
        time_of_day: '09:00',
        timezone: 'UTC',
        time_period: 'last_24h',
        channel_mode: 'specific',
        channel_ids: [channel.id],
        agent_id: agent.id,
        is_recurring: true,
    });

    // # Open the Scheduled tab and launch the edit modal from the recap's Options menu.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();
    await recapsPage.switchToScheduled();

    const scheduledRecap = recapsPage.getScheduledRecap(originalTitle);
    await scheduledRecap.toBeVisible();
    await scheduledRecap.editViaMenu();

    // # Update the title on the first step and add Wednesday on the schedule step of the pre-filled modal.
    const editModal = recapsPage.createRecapModal;
    await editModal.toBeVisible();
    await editModal.fillTitle(updatedTitle);
    await editModal.clickNext();
    await editModal.expectChannelSelectorVisible();
    await editModal.clickNext();
    await editModal.expectScheduleConfigurationVisible();
    await editModal.selectScheduleDay('W');
    await editModal.saveChanges();

    // * Verify the list reflects the new title and the dropped original title, and shows the added day.
    await recapsPage.toBeVisible();
    const updatedRecap = recapsPage.getScheduledRecap(updatedTitle);
    await updatedRecap.toBeVisible();
    await updatedRecap.expectSchedulePattern(/Wed|Wednesday/);
    await recapsPage.expectScheduledRecapNotVisible(originalTitle);

    // * Verify the persisted scheduled recap carries the updated title and the Monday+Wednesday schedule.
    await pw.waitUntil(
        async () => {
            const scheduledRecaps = await userClient.getScheduledRecaps(0, 60);
            const persisted = scheduledRecaps.find((recap) => recap.title === updatedTitle);
            return Boolean(persisted) && persisted?.days_of_week === (MONDAY | WEDNESDAY);
        },
        {timeout: pw.duration.one_min},
    );

    const scheduledRecaps = await userClient.getScheduledRecaps(0, 60);
    expect(scheduledRecaps.some((recap) => recap.title === originalTitle)).toBe(false);
    const persisted = scheduledRecaps.find((recap) => recap.title === updatedTitle);
    expect(persisted).toBeDefined();
    expect(persisted?.days_of_week).toBe(MONDAY | WEDNESDAY);
    expect(persisted?.channel_ids).toContain(channel.id);

    // * Verify the edit updated the existing recap in place (same id) rather than recreating it, and
    //   that fields untouched by the edit (time_of_day) survived.
    expect(persisted?.id).toBe(createdRecap.id);
    expect(persisted?.time_of_day).toBe('09:00');
});

/**
 * @objective Verify a user can delete a scheduled recap through the Options menu and confirm dialog
 */
test('deletes a scheduled recap through the options menu', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Deletable scheduled recap ${pw.random.id()}`;
    const sourceMessage = `Delete scheduled source ${pw.random.id()}`;

    // # Initialize the test server state, configure the recap bridge, and seed a channel.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Delete scheduled recap channel',
        sourceMessage,
    );

    // # Create a scheduled recap through the API so the UI delete flow has something to remove.
    const createdRecap = await userClient.createScheduledRecap({
        title: recapTitle,
        days_of_week: MONDAY,
        time_of_day: '09:00',
        timezone: 'UTC',
        time_period: 'last_24h',
        channel_mode: 'specific',
        channel_ids: [channel.id],
        agent_id: agent.id,
        is_recurring: true,
    });

    // # Open the Scheduled tab, trigger Delete from the Options menu, and confirm the dialog.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();
    await recapsPage.switchToScheduled();

    const scheduledRecap = recapsPage.getScheduledRecap(recapTitle);
    await scheduledRecap.toBeVisible();
    await scheduledRecap.deleteViaMenu();
    await recapsPage.confirmDelete();

    // * Verify the recap disappears from the list and the empty state returns.
    await recapsPage.expectScheduledRecapNotVisible(recapTitle);
    await recapsPage.expectScheduledEmptyState();

    // * Verify the scheduled recap is no longer returned by the API.
    await pw.waitUntil(
        async () => {
            const scheduledRecaps = await userClient.getScheduledRecaps(0, 60);
            return !scheduledRecaps.some((recap) => recap.id === createdRecap.id);
        },
        {timeout: pw.duration.one_min},
    );
});

/**
 * @objective Verify a fresh user with no scheduled recaps sees the scheduled empty-state call to action
 */
test('shows the scheduled empty state for a user with no scheduled recaps', {tag: '@ai_recaps'}, async ({pw}) => {
    // # Initialize the test server state and configure the recap bridge so the page renders fully.
    const {adminClient, team, user} = await pw.initSetup();
    await setupRecapBridge(pw, adminClient, {
        completions: [],
    });

    // # Open the recaps page and switch to the Scheduled tab.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();
    await recapsPage.switchToScheduled();

    // * Verify the scheduled empty state heading, description, and create CTA are shown.
    await recapsPage.expectScheduledEmptyState();

    // * Verify the empty-state CTA is wired up: clicking it opens the create recap modal.
    const createRecapModal = await recapsPage.openCreateRecapFromScheduledEmptyState();
    await createRecapModal.toBeVisible();
});

/**
 * @objective Verify the all-unreads scheduled flow skips channel selection and stores the all_unreads mode
 */
test('creates an all-unreads scheduled recap through the modal', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `All unreads scheduled recap ${pw.random.id()}`;
    const sourceMessage = `All unreads scheduled source ${pw.random.id()}`;

    // # Initialize the test server state, configure the recap bridge, and seed an unread channel.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [],
    });

    await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'All unreads scheduled channel',
        sourceMessage,
    );

    // # Open the modal, choose all-unreads mode, and advance directly to the schedule step.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const createRecapModal = await recapsPage.openCreateRecap();
    await createRecapModal.fillTitle(recapTitle);
    await createRecapModal.selectAllUnreads();
    await createRecapModal.clickNext();

    // * Verify the all-unreads flow skips the channel selector and lands on schedule configuration.
    await createRecapModal.expectChannelSelectorHidden();
    await createRecapModal.expectScheduleConfigurationVisible();
    await createRecapModal.selectScheduleDay('M');
    await createRecapModal.createSchedule();

    // * Verify the scheduled recap is listed.
    await recapsPage.toBeVisible();
    await recapsPage.switchToScheduled();
    await recapsPage.getScheduledRecap(recapTitle).toBeVisible();

    // * Verify the persisted scheduled recap uses the all_unreads channel mode and is active.
    await pw.waitUntil(
        async () => {
            const scheduledRecaps = await userClient.getScheduledRecaps(0, 60);
            return scheduledRecaps.some((recap) => recap.title === recapTitle);
        },
        {timeout: pw.duration.one_min},
    );

    const scheduledRecaps = await userClient.getScheduledRecaps(0, 60);
    const persisted = scheduledRecaps.find((recap) => recap.title === recapTitle);
    expect(persisted).toBeDefined();
    expect(persisted?.channel_mode).toBe('all_unreads');
    expect(persisted?.agent_id).toBe(agent.id);
    expect(persisted?.days_of_week).toBe(MONDAY);
    expect(persisted?.enabled).toBe(true);

    // * Verify the all_unreads contract is fully pinned: no specific channels are persisted.
    expect(persisted?.channel_ids ?? []).toHaveLength(0);
});
