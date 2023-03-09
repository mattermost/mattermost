// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {ModalIdentifiers} from 'utils/constants';
import {isModalOpen} from 'selectors/views/modals';

import {GlobalState} from 'types/store';

import TeamSettingsModal from './team_settings_modal';

function mapStateToProps(state: GlobalState) {
    const modalId = ModalIdentifiers.TEAM_SETTINGS;
    return {
        show: isModalOpen(state, modalId),
        isCloud: getLicense(state).Cloud === 'true',
    };
}

export default connect(mapStateToProps)(TeamSettingsModal);
