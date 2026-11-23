// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import {isMinimumProfessionalLicense} from 'utils/license_utils';

import PasskeySection from './passkey_section';

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const licensed = license.IsLicensed === 'true' && isMinimumProfessionalLicense(license);

    return {
        visible: getConfig(state).FeatureFlagPasskeys === 'true' && licensed,
    };
}

export default connect(mapStateToProps)(PasskeySection);
