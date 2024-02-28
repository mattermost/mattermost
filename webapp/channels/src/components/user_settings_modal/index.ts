// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {isModalOpen} from 'selectors/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import UserSettingsModal from './user_settings_modal';

function mapStateToProps(state: GlobalState) {
    const modalId = ModalIdentifiers.USER_SETTINGS;
    return {
        show: isModalOpen(state, modalId),
    };
}

export default connect(mapStateToProps)(UserSettingsModal);
