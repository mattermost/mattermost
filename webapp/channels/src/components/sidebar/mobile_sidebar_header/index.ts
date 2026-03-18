// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import MobileSidebarHeader from './mobile_sidebar_header';

function mapStateToProps(state: GlobalState) {
    const currentTeam = getCurrentTeam(state);
    const currentUser = getCurrentUser(state);

    return {
        username: currentUser?.username,
        teamDisplayName: currentTeam?.display_name ?? '',
    };
}

const mapDispatchToProps = {
    openModal,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(MobileSidebarHeader);
