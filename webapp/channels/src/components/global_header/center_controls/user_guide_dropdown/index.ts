// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';
import {withRouter} from 'react-router-dom';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {GenericAction} from 'mattermost-redux/types/actions';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getIsOnboardingFlowEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {isFirstAdmin} from 'mattermost-redux/selectors/entities/users';

import {getUserGuideDropdownPluginMenuItems} from 'selectors/plugins';

import {GlobalState} from 'types/store';

import {openModal} from 'actions/views/modals';

import {getIsMobileView} from 'selectors/views/browser';

import UserGuideDropdown from './user_guide_dropdown';

function mapStateToProps(state: GlobalState) {
    const {HelpLink, ReportAProblemLink, EnableAskCommunityLink} = getConfig(state);

    return {
        helpLink: HelpLink || '',
        isMobileView: getIsMobileView(state),
        reportAProblemLink: ReportAProblemLink || '',
        enableAskCommunityLink: EnableAskCommunityLink || '',
        teamUrl: getCurrentRelativeTeamUrl(state),
        pluginMenuItems: getUserGuideDropdownPluginMenuItems(state),
        isFirstAdmin: isFirstAdmin(state),
        onboardingFlowEnabled: getIsOnboardingFlowEnabled(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default withRouter(connector(UserGuideDropdown));
