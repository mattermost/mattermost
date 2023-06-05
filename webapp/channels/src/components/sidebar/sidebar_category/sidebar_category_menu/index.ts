// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';

import {setCategoryMuted, setCategorySorting} from 'mattermost-redux/actions/channel_categories';

import {openModal} from 'actions/views/modals';

import SidebarCategoryMenu from './sidebar_category_menu';

import {GlobalState} from 'types/store';

import {getIsMobileView} from 'selectors/views/browser';

import {haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import Permissions from 'mattermost-redux/constants/permissions';

function mapStateToProps() {

    return (state: GlobalState) => {
        return {
            isMobileView: getIsMobileView(state),
            canJoinPublicChannel: haveICurrentChannelPermission(state, Permissions.JOIN_PUBLIC_CHANNELS),
        };
    };
}

const mapDispatchToProps = {
    openModal,
    setCategoryMuted,
    setCategorySorting,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(SidebarCategoryMenu);
