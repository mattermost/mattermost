// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {withRouter} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getReportAProblemLink} from 'mattermost-redux/selectors/entities/report_a_problem';
import {isFirstAdmin} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';
import {getUserGuideDropdownPluginMenuItems} from 'selectors/plugins';

import type {GlobalState} from 'types/store';

import UserGuideDropdown from './user_guide_dropdown';

function mapStateToProps(state: GlobalState) {
    const {HelpLink, EnableAskCommunityLink} = getConfig(state);

    const reportAProblemLink = getReportAProblemLink(state);
    return {
        helpLink: HelpLink || '',
        reportAProblemLink,
        enableAskCommunityLink: EnableAskCommunityLink || '',
        pluginMenuItems: getUserGuideDropdownPluginMenuItems(state),
        isFirstAdmin: isFirstAdmin(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default withRouter(connector(UserGuideDropdown));
