// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, getRandomId, newTestPassword} from '@mattermost/playwright-lib';

/**
 * @objective Verify mmctl — the same binary bundled in the server image — can administer the
 * real test server as a remote client, run from a separate container instance built from that
 * same image rather than the server's own container's `--local` unix socket.
 *
 * @precondition
 * Full (Testcontainers) mode, so a Docker network and the server image are available to build a
 * second, independent mmctl container instance from.
 */
test('creates a user through a remote mmctl container instance', {tag: '@mmctl'}, async ({pw}) => {
    await pw.ensureMmctl();

    const {adminClient} = await pw.getAdminClient();

    const randomId = getRandomId();
    const username = `mmctluser${randomId}`;
    const email = `${username}@mmtest.com`;

    // # Create a user via mmctl running in a separate remote container instance
    const result = await pw.runMmctl([
        'user',
        'create',
        '--username',
        username,
        '--email',
        email,
        '--password',
        newTestPassword(),
    ]);

    // * Verify the mmctl command succeeded
    expect(result.exitCode, result.output).toBe(0);

    // * Verify the user was actually created on the real server
    const createdUser = await adminClient.getUserByUsername(username);
    expect(createdUser.email).toBe(email);
});

/**
 * @objective Verify the remote mmctl container reports the same version as the server, since
 * both come from the same image — a sanity check that the "different container/instance, same
 * image" setup is actually using the image it claims to.
 *
 * @precondition
 * Full (Testcontainers) mode, so a Docker network and the server image are available to build a
 * second, independent mmctl container instance from.
 */
test('reports the same version as the server it is bundled with', {tag: '@mmctl'}, async ({pw}) => {
    await pw.ensureMmctl();

    const {adminClient} = await pw.getAdminClient();
    // release-10.11 client still exposes this as getClientConfigOld (renamed to getClientConfig later)
    const serverConfig = await adminClient.getClientConfigOld();

    // # Query the version reported by the remote mmctl container instance
    const result = await pw.runMmctl(['version', '--json']);
    expect(result.exitCode, result.output).toBe(0);

    // * Verify the remote mmctl reports the same version as the server it's bundled with
    const [mmctlVersionInfo] = JSON.parse(result.output);
    expect(mmctlVersionInfo.Version).toBe(serverConfig.Version);
});
