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
            time_period: 'last_24h',
            channel_mode: 'specific',
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
