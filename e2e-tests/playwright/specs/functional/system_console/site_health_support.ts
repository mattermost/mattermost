// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, type PlaywrightExtended} from '@mattermost/playwright-lib';

export async function skipUnlessEnterprise(pw: PlaywrightExtended) {
    const {adminClient} = await pw.getAdminClient();
    const license = await adminClient.getClientLicenseOld();

    test.skip(
        !['enterprise', 'advanced'].includes(license.SkuShortName),
        'Skipping test - server has no enterprise or enterprise advanced license',
    );
}
