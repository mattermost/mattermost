// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Real API Test Helpers - No Mocks!
// Uses actual Mattermost server running on localhost:8065

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

// Test configuration - uses same defaults as Cypress e2e tests
// Note: Using username instead of email for login (works with any email)
// IMPORTANT: Hardcoded to 'sysadmin' to avoid LDAP env var conflicts
const TEST_CONFIG = {
    serverUrl: 'http://localhost:8065',
    adminUsername: 'sysadmin', // Hardcoded - ignore env vars
    adminPassword: 'Sys@dmin-sample1', // Hardcoded - ignore env vars
    testPrefix: 'api-test',
};

// Set Client4 to use local server
Client4.setUrl(TEST_CONFIG.serverUrl);

// Helper to create default TipTap JSON content
export function createDefaultTipTapContent(text: string): string {
    return JSON.stringify({
        type: 'doc',
        content: [
            {
                type: 'paragraph',
                content: [{type: 'text', text}],
            },
        ],
    });
}

// Helper to create TipTap content with heading
export function createTipTapContentWithHeading(title: string, bodyText: string): string {
    return JSON.stringify({
        type: 'doc',
        content: [
            {
                type: 'heading',
                attrs: {level: 1},
                content: [{type: 'text', text: title}],
            },
            {
                type: 'paragraph',
                content: [{type: 'text', text: bodyText}],
            },
        ],
    });
}

export interface TestContext {
    user: UserProfile;
    team: Team;
    channel: Channel;
    token: string;
    cleanup: () => Promise<void>;
}

export interface WikiTestContext extends TestContext {
    wikiId: string;
    pageIds: string[];
}

let createdResources: {
    teams: string[];
    channels: string[];
    users: string[];
    wikis: string[];
    pages: string[];
} = {
    teams: [],
    channels: [],
    users: [],
    wikis: [],
    pages: [],
};

let originalEnableOpenServer: boolean | null = null;

export async function enableOpenServerForTests(): Promise<void> {
    try {
        // Login as admin first (using username, not email)
        await Client4.login(TEST_CONFIG.adminUsername, TEST_CONFIG.adminPassword);

        // Get current config to save original value
        const config = await Client4.getConfig();
        originalEnableOpenServer = config.TeamSettings?.EnableOpenServer || false;

        // Enable open server for testing
        await Client4.patchConfig({
            TeamSettings: {
                EnableOpenServer: true,
            },
        });
    } catch (error) {
        console.error('Failed to enable open server:', error);
        throw error;
    }
}

export async function restoreServerConfig(): Promise<void> {
    if (originalEnableOpenServer !== null) {
        try {
            await Client4.login(TEST_CONFIG.adminUsername, TEST_CONFIG.adminPassword);
            await Client4.patchConfig({
                TeamSettings: {
                    EnableOpenServer: originalEnableOpenServer,
                },
            });
        } catch (error) {
            console.warn('Failed to restore server config:', error);
        }
    }
}

export async function setupTestUser(): Promise<{user: UserProfile; token: string}> {
    const timestamp = Date.now();
    const username = `${TEST_CONFIG.testPrefix}-user-${timestamp}`;
    const email = `${username}@test.com`;

    try {
        const user = await Client4.createUser({
            email,
            username,
            password: 'Test123!@#',
            first_name: 'Test',
            last_name: 'User',
        } as any, '', '');

        createdResources.users.push(user.id);

        const loginResponse = await Client4.login(email, 'Test123!@#');
        const token = Client4.getToken();

        return {user: loginResponse, token};
    } catch (error) {
        console.error('Failed to create test user:', error);
        throw error;
    }
}

export async function setupTestTeam(userId: string): Promise<Team> {
    // Use crypto random for better uniqueness (Jest runs tests in parallel)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const random2 = Math.random().toString(36).substring(2, 10);
    const name = `test${timestamp}${random}${random2}`.substring(0, 64); // Max 64 chars

    try {
        const team = await Client4.createTeam({
            name,
            display_name: `Test Team ${timestamp}`,
            type: 'O',
        } as any);

        createdResources.teams.push(team.id);

        await Client4.addToTeam(team.id, userId);

        return team;
    } catch (error) {
        console.error('Failed to create test team:', error);
        throw error;
    }
}

export async function setupTestChannel(teamId: string): Promise<Channel> {
    const timestamp = Date.now();
    const name = `${TEST_CONFIG.testPrefix}-ch-${timestamp}`;

    try {
        const channel = await Client4.createChannel({
            team_id: teamId,
            name,
            display_name: `Test Channel ${timestamp}`,
            type: 'O',
        });

        createdResources.channels.push(channel.id);

        return channel;
    } catch (error) {
        console.error('Failed to create test channel:', error);
        throw error;
    }
}

export async function setupTestContext(): Promise<TestContext> {
    // Login as sysadmin
    await Client4.login(TEST_CONFIG.adminUsername, TEST_CONFIG.adminPassword);
    const user = await Client4.getMe();
    const token = Client4.getToken();

    // Get existing teams for sysadmin (or use first available team)
    const teams = await Client4.getMyTeams();
    if (teams.length === 0) {
        throw new Error('Sysadmin has no teams. Please create a team first.');
    }
    const team = teams[0];

    // Create test channel in existing team
    const channel = await setupTestChannel(team.id);

    const cleanup = async () => {
        await cleanupTestResources();
    };

    return {
        user,
        team,
        channel,
        token,
        cleanup,
    };
}

export async function setupWikiTestContext(): Promise<WikiTestContext> {
    const context = await setupTestContext();

    try {
        const wiki = await Client4.createWiki({
            channel_id: context.channel.id,
            title: `Test Wiki ${Date.now()}`,
        });

        createdResources.wikis.push(wiki.id);

        return {
            ...context,
            wikiId: wiki.id,
            pageIds: [],
        };
    } catch (error) {
        console.error('Failed to create test wiki:', error);
        await context.cleanup();
        throw error;
    }
}

export async function createTestPage(wikiId: string, title: string, parentId?: string): Promise<string> {
    try {
        const draftId = `draft-${Date.now()}`;
        const content = createTipTapContentWithHeading(title, `Test page content for ${title}`);

        await Client4.savePageDraft(wikiId, draftId, content, title, 0, {
            page_parent_id: parentId || undefined,
        });

        const page = await Client4.publishPageDraft(wikiId, draftId, parentId || '', title, '', content);

        createdResources.pages.push(page.id);

        return page.id;
    } catch (error) {
        console.error('Failed to create test page:', error);
        throw error;
    }
}

export async function cleanupTestResources(): Promise<void> {
    const errors: Error[] = [];

    for (const pageId of createdResources.pages) {
        try {
        // eslint-disable-next-line no-await-in-loop
            await Client4.deletePost(pageId);
        } catch (error) {
            errors.push(error as Error);
        }
    }

    for (const wikiId of createdResources.wikis) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await Client4.deleteWiki(wikiId);
        } catch (error) {
            errors.push(error as Error);
        }
    }

    for (const channelId of createdResources.channels) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await Client4.deleteChannel(channelId);
        } catch (error) {
            errors.push(error as Error);
        }
    }

    for (const teamId of createdResources.teams) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await Client4.deleteTeam(teamId);
        } catch (error) {
            errors.push(error as Error);
        }
    }

    // Note: deleteUser is not available in Client4, users will be cleaned up by server
    // No action needed for user cleanup

    createdResources = {
        teams: [],
        channels: [],
        users: [],
        wikis: [],
        pages: [],
    };

    if (errors.length > 0) {
        console.warn(`[Cleanup] Completed with ${errors.length} errors`);
    }
}

export function trackResource(type: keyof typeof createdResources, id: string) {
    createdResources[type].push(id);
}

export async function cleanupOrphanedTestResources(): Promise<void> {
    try {
        await Client4.login(TEST_CONFIG.adminUsername, TEST_CONFIG.adminPassword);

        const teams = await Client4.getMyTeams();
        const orphanedCount = {channels: 0, wikis: 0};

        for (const team of teams) {
            // eslint-disable-next-line no-await-in-loop
            const channels = await Client4.getMyChannels(team.id);

            for (const channel of channels) {
                if (channel.name.startsWith(TEST_CONFIG.testPrefix)) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        await Client4.deleteChannel(channel.id);
                        orphanedCount.channels++;
                    } catch (error) {
                        console.warn(`[Cleanup] Failed to delete orphaned channel ${channel.name}`);
                    }
                }
            }
        }
    } catch (error) {
        console.warn('[Cleanup] Failed to cleanup orphaned resources:', error);
    }
}

export async function loginAsAdmin(): Promise<UserProfile> {
    try {
        const user = await Client4.login(TEST_CONFIG.adminUsername, TEST_CONFIG.adminPassword);
        return user;
    } catch (error) {
        console.error('Failed to login as admin:', error);
        throw new Error('Could not login as admin. Is the server running? Are credentials correct?');
    }
}

export async function waitForServer(maxAttempts = 5, delayMs = 1000): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const ping = await Client4.ping(false);
            if (ping.status === 'OK') {
                return true;
            }
        } catch (error) {
            if (i < maxAttempts - 1) {
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }
    return false;
}

export async function isServerAvailable(): Promise<boolean> {
    try {
        const ping = await Client4.ping(false);
        return ping.status === 'OK';
    } catch (error) {
        return false;
    }
}

export async function requireServer(): Promise<void> {
    const available = await isServerAvailable();
    if (!available) {
        console.warn(`
⚠️  Mattermost server not available on ${TEST_CONFIG.serverUrl}
   These integration tests require a running server.
   Skipping tests...

   To run these tests:
   1. cd server
   2. make run-server
   3. Wait for server to start
   4. Re-run tests
`);
        throw new Error('Server not available - tests skipped');
    }
}
