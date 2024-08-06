// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {PreferenceType} from '@mattermost/types/preferences';

import {getStandardAnalytics} from 'mattermost-redux/actions/admin';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Permissions} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {makeGetCategory} from 'mattermost-redux/selectors/entities/preferences';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import {dismissNotice} from 'actions/views/notice';

import Notices from 'components/system_notice/notices';
import SystemNotice from 'components/system_notice/system_notice';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

const getSystemNoticePreferences = makeGetCategory('getSystemNoticePreferences', Preferences.CATEGORY_SYSTEM_NOTICE);
const getPreferenceNameMap = createSelector(
    'getPreferenceNameMap',
    getSystemNoticePreferences,
    (preferences) => {
        const nameMap: {[key: string]: PreferenceType} = {};
        preferences.forEach((p) => {
            nameMap[p.name] = p;
        });
        return nameMap;
    },
);

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const config = getConfig(state);
    const serverVersion = state.entities.general.serverVersion;
    const analytics = state.entities.admin.analytics;

    return {
        currentUserId: state.entities.users.currentUserId,
        preferences: getPreferenceNameMap(state),
        dismissedNotices: state.views.notice.hasBeenDismissed,
        isSystemAdmin: haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM}),
        notices: Notices,
        config,
        license,
        serverVersion,
        analytics,
        currentChannel: getCurrentChannel(state),
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

export default connect(mapStateToProps, mapDispatchToProps)(SystemNotice);
