// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';

import {openModal} from 'actions/views/modals';
import {setCategoryMuted, setCategorySorting} from 'mattermost-redux/actions/channel_categories';

import SidebarCategoryMenu from './sidebar_category_menu';

const mapDispatchToProps = {
    openModal,
    setCategoryMuted,
    setCategorySorting,
};

const connector = connect(null, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(SidebarCategoryMenu);
