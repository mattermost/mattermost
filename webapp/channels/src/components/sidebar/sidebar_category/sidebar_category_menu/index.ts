// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {setCategoryMuted, setCategorySorting} from 'mattermost-redux/actions/channel_categories';

import {openModal} from 'actions/views/modals';

import SidebarCategoryMenu from './sidebar_category_menu';

import type {ConnectedProps} from 'react-redux';

const mapDispatchToProps = {
    openModal,
    setCategoryMuted,
    setCategorySorting,
};

const connector = connect(null, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(SidebarCategoryMenu);
