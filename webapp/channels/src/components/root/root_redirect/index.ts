// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getFirstAdminSetupComplete} from 'mattermost-redux/actions/general';
import {getIsOnboardingFlowEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId, isCurrentUserSystemAdmin, isFirstAdmin} from 'mattermost-redux/selectors/entities/users';

import RootRedirect from './root_redirect';

import type {Props} from './root_redirect';
import type {GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

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

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, Props['actions']>({
            getFirstAdminSetupComplete,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(RootRedirect);
