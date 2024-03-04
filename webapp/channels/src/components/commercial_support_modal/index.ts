// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import CommercialSupportModal from './commercial_support_modal';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const license = getLicense(state);
    const isCloud = license.Cloud === 'true';
    const currentUser = getCurrentUser(state);
    const showBannerWarning = (config.EnableFile !== 'true' || config.FileLevel !== 'DEBUG') && !(isCloud);
    let packetContents = [
        {id: 'basic.contents', translation: '', default_label: 'Basic sontents', selected: true, mandatory: true},
        {id: 'basic.server.logs', translation: '', default_label: 'Server logs', selected: false, mandatory: false},
    ]

    return {
        isCloud,
        currentUser,
        showBannerWarning,
        packetContents,
    };
}

export default connect(mapStateToProps)(CommercialSupportModal);
