// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type SystemConsolePage} from '@mattermost/playwright-lib';

/**
 * Navigate from the System Console sidebar to the Site Configuration > Localization page
 * and wait until the URL reflects the Localization admin route.
 * Shared by the autotranslation_system_console_* specs.
 */
export async function gotoLocalization(systemConsolePage: SystemConsolePage): Promise<void> {
    await systemConsolePage.sidebar.siteConfiguration.localization.click();
    await systemConsolePage.page.waitForURL(/\/admin_console\/site_config\/localization/);
}
