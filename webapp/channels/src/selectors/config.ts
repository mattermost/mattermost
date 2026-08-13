// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';

export function isAnonymousURLEnabled(state: GlobalState): boolean {
    const license = getLicense(state);
    const config = getConfig(state);

    return (
        config.UseAnonymousURLs === 'true' &&
        isMinimumEnterpriseAdvancedLicense(license)
    );
}
