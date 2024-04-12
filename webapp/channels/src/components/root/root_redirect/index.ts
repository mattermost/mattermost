// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getFirstAdminSetupComplete} from 'mattermost-redux/actions/general';
import {getIsOnboardingFlowEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId, isCurrentUserSystemAdmin, isFirstAdmin} from 'mattermost-redux/selectors/entities/users';

import {redirectUserToDefaultTeam} from 'actions/global_actions';

import type {GlobalState} from 'types/store';

import RootRedirect from './root_redirect';

function mapStateToProps(state: GlobalState) {
    const onboardingFlowEnabled = getIsOnboardingFlowEnabled(state);
    let isElegibleForFirstAdmingOnboarding = onboardingFlowEnabled;
    if (isElegibleForFirstAdmingOnboarding) {
        isElegibleForFirstAdmingOnboarding = isCurrentUserSystemAdmin(state);
    }
    return {
        currentUserId: getCurrentUserId(state),
        isElegibleForFirstAdmingOnboarding,
        isFirstAdmin: isFirstAdmin(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getFirstAdminSetupComplete,
            redirectUserToDefaultTeam,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RootRedirect);
