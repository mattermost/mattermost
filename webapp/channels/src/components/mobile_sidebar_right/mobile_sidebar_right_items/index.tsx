// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';
import {getCloudSubscription as selectCloudSubscription, getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {
    getConfig,
    getLicense,
} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getReportAProblemLink} from 'mattermost-redux/selectors/entities/report_a_problem';
import {
    getJoinableTeamIds,
    getCurrentTeam,
} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUser, getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';
import {showMentions, showFlaggedPosts, closeRightHandSide, closeMenu as closeRhsMenu} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';
import {makeGetCustomStatus, isCustomStatusExpired, isCustomStatusEnabled} from 'selectors/views/custom_status';

import {RHSStates, CloudProducts} from 'utils/constants';
import {isCloudLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import MobileSidebarRightItems from './mobile_sidebar_right_items';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const currentTeam = getCurrentTeam(state);
    const currentUser = getCurrentUser(state);
    const userId = currentUser?.id;

    const appDownloadLink = config.AppDownloadLink;
    const siteName = config.SiteName;
    const experimentalPrimaryTeam = config.ExperimentalPrimaryTeam;
    const helpLink = config.HelpLink;
    const reportAProblemLink = getReportAProblemLink(state);

    const joinableTeams = getJoinableTeamIds(state);
    const moreTeamsToJoin = joinableTeams && joinableTeams.length > 0;
    const rhsState = getRhsState(state);

    const subscription = selectCloudSubscription(state);
    const license = getLicense(state);
    const subscriptionProduct = getSubscriptionProduct(state);

    const isCloud = isCloudLicense(license);
    const isStarterFree = isCloud && subscriptionProduct?.sku === CloudProducts.STARTER;
    const isFreeTrial = isCloud && subscription?.is_free_trial === 'true';

    const getCustomStatus = makeGetCustomStatus();
    const customStatus = getCustomStatus(state, userId);

    return {
        appDownloadLink,
        experimentalPrimaryTeam,
        helpLink,
        reportAProblemLink,
        pluginMenuItems: state.plugins.components.MainMenu,
        moreTeamsToJoin,
        siteName,
        teamId: currentTeam?.id,
        teamName: currentTeam?.name,
        isMentionSearch: rhsState === RHSStates.MENTION,
        teamIsGroupConstrained: Boolean(currentTeam?.group_constrained),
        isLicensedForLDAPGroups: state.entities.general.license.LDAPGroups === 'true',
        guestAccessEnabled: config.EnableGuestAccounts === 'true',
        isStarterFree,
        isFreeTrial,

        // user account menu needs
        userId,
        profilePicture: Client4.getProfilePictureUrl(userId, currentUser?.last_picture_update),
        autoResetPref: get(state, Preferences.CATEGORY_AUTO_RESET_MANUAL_STATUS, userId, ''),
        status: getStatusForUserId(state, userId),
        customStatus,
        isCustomStatusExpired: isCustomStatusExpired(state, customStatus),
        isCustomStatusEnabled: isCustomStatusEnabled(state),
        timezone: getCurrentTimezone(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            showMentions,
            showFlaggedPosts,
            closeRightHandSide,
            closeRhsMenu,
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(MobileSidebarRightItems);
