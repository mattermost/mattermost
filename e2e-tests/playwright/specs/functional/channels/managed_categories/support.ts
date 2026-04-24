// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

export async function skipIfNoEnterpriseLicense(adminClient: any) {
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.IsLicensed !== 'true', 'Skipping test - server does not have an enterprise license');
}

export async function enableManagedCategories(adminClient: any) {
    await adminClient.patchConfig({
        TeamSettings: {
            EnableManagedChannelCategories: true,
        },
    });
}

export async function disableManagedCategories(adminClient: any) {
    await adminClient.patchConfig({
        TeamSettings: {
            EnableManagedChannelCategories: false,
        },
    });
}

export async function createChannelWithManagedCategory(
    adminClient: any,
    teamId: string,
    categoryName: string,
    channelSuffix: string,
) {
    const channel = await adminClient.createChannel({
        team_id: teamId,
        name: `managed-cat-${channelSuffix}-${Date.now()}`,
        display_name: `Managed ${channelSuffix} ${Date.now()}`,
        type: 'O',
    });
    await adminClient.patchChannel(channel.id, {managed_category_name: categoryName});
    return channel;
}
