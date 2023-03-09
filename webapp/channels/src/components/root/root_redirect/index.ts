// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {getFirstAdminSetupComplete} from 'mattermost-redux/actions/general';
import {getCurrentUserId, isCurrentUserSystemAdmin, isFirstAdmin} from 'mattermost-redux/selectors/entities/users';
import {getUseCaseOnboarding} from 'mattermost-redux/selectors/entities/preferences';
import {GenericAction} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store';

import RootRedirect, {Props} from './root_redirect';

function mapStateToProps(state: GlobalState) {
    const useCaseOnboarding = getUseCaseOnboarding(state);
    let isElegibleForFirstAdmingOnboarding = useCaseOnboarding;
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
