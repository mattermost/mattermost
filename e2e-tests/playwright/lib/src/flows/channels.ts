// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import type {TestBrowser} from '@/browser_context';
import type {App, ChannelsPageParams} from '@/ui/generated';

/**
 * Logs the user in and opens a channel: `const app = await openChannel(pw, user, {team, channel: townSquare})`.
 * Returns once the generated `goto` does (when the page has a ready element configured, once it shows).
 */
export async function openChannel(
    pw: {testBrowser: TestBrowser},
    user: UserProfile,
    params: ChannelsPageParams,
): Promise<App> {
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto(params);
    return app;
}
