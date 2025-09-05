// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getPostHistoryLimitBannerPreferences} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';
import useGetServerLimits from 'components/common/hooks/useGetServerLimits';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import {Preferences, AnnouncementBarTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './post_history_limit_banner.scss';

const shouldShowDespiteDismissal = (
    dismissalTimestamp: number,
    isAdmin: boolean,
    postsStillTruncated: boolean,
): boolean => {
    if (!dismissalTimestamp || !postsStillTruncated) {
        return false;
    }

    const daysSinceDismissal = (Date.now() - dismissalTimestamp) / (1000 * 60 * 60 * 24);
    const threshold = isAdmin ? 7 : 30; // 7 days for admins, 30 for users

    return daysSinceDismissal >= threshold;
};

const PostHistoryLimitBanner = () => {
    const {openPricingModal} = useOpenPricingModal();
    const dispatch = useDispatch();
    const [serverLimits, limitsLoaded] = useGetServerLimits();
    const currentUser = useSelector((state: GlobalState) => getCurrentUser(state));
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const license = useSelector(getLicense);
    const postHistoryLimitPreferences = useSelector(getPostHistoryLimitBannerPreferences);

    // Key condition: posts are actually being truncated
    const postsAreTruncated = (serverLimits?.lastAccessiblePostTime || 0) > 0;
    const postHistoryLimit = serverLimits?.postHistoryLimit || 0;
    const lastAccessiblePostTime = serverLimits?.lastAccessiblePostTime || 0;

    const prefixLicenseId = (license.Id || '').substring(0, 8);
    const preferenceName = `post_history_limit_${prefixLicenseId}`;

    // Get dismissal timestamp from preferences
    const dismissalPreference = postHistoryLimitPreferences.find(
        (pref) => pref.name === preferenceName,
    );
    const dismissalTimestamp = dismissalPreference ? parseInt(dismissalPreference.value, 10) : 0;

    // Check if banner should show despite previous dismissal
    const showDespiteDismissal = shouldShowDespiteDismissal(
        dismissalTimestamp,
        isAdmin,
        postsAreTruncated,
    );

    const handleClose = () => {
        dispatch(savePreferences(currentUser.id, [{
            category: Preferences.POST_HISTORY_LIMIT_BANNER,
            name: preferenceName,
            user_id: currentUser.id,
            value: Date.now().toString(), // Store current timestamp
        }]));
    };

    const handleUpgradeClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        openPricingModal({trackingLocation: 'post_history_limit_banner'});
    };

    // Show banner if never dismissed OR enough time has passed AND still truncated
    const shouldShow = limitsLoaded && postsAreTruncated && (!dismissalTimestamp || showDespiteDismissal);

    if (!shouldShow) {
        return null;
    }

    // Format the cutoff date
    const cutoffDate = new Date(lastAccessiblePostTime);
    const formattedDate = cutoffDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const message = (
        <FormattedMessage
            id='workspace_limits.post_history_banner.text'
            defaultMessage='{limit, number}-message limit reached. Messages sent before {date} are hidden. Upgrade to restore access'
            values={{
                limit: postHistoryLimit,
                date: formattedDate,
            }}
        />
    );

    const upgradeButtonText = {
        id: 'workspace_limits.post_history_banner.upgrade_button',
        defaultMessage: 'Upgrade',
    };

    return (
        <AnnouncementBar
            type={AnnouncementBarTypes.GENERAL}
            showCloseButton={true}
            onButtonClick={handleUpgradeClick}
            modalButtonText={upgradeButtonText}
            message={message}
            showLinkAsButton={true}
            className='post-history-limit-banner'

            //  color='#ffd470'
            // textColor='#1a1919'
            icon={<i className='icon icon-alert-outline'/>}
            handleClose={handleClose}
        />
    );
};

export default PostHistoryLimitBanner;
