// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {makeGetCategory} from 'mattermost-redux/selectors/entities/preferences';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Permissions} from 'mattermost-redux/constants';
import {getStandardAnalytics} from 'mattermost-redux/actions/admin';

import {PreferenceType} from '@mattermost/types/preferences';

import {Preferences} from 'utils/constants';

import {dismissNotice} from 'actions/views/notice';

import Notices from 'components/system_notice/notices';
import SystemNotice from 'components/system_notice/system_notice';
import {GlobalState} from 'types/store';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

function makeMapStateToProps() {
    const getCategory = makeGetCategory();

    const getPreferenceNameMap = createSelector(
        'getPreferenceNameMap',
        getCategory,
        (preferences) => {
            const nameMap: {[key: string]: PreferenceType} = {};
            preferences.forEach((p) => {
                nameMap[p.name] = p;
            });
            return nameMap;
        },
    );

    return function mapStateToProps(state: GlobalState) {
        const license = getLicense(state);
        const config = getConfig(state);
        const serverVersion = state.entities.general.serverVersion;
        const analytics = state.entities.admin.analytics;

        return {
            currentUserId: state.entities.users.currentUserId,
            preferences: getPreferenceNameMap(state, Preferences.CATEGORY_SYSTEM_NOTICE),
            dismissedNotices: state.views.notice.hasBeenDismissed,
            isSystemAdmin: haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM}),
            notices: Notices,
            config,
            license,
            serverVersion,
            analytics,
            currentChannel: getCurrentChannel(state),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            savePreferences,
            dismissNotice,
            getStandardAnalytics,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(SystemNotice);
