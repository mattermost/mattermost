// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';
import type {ClientLicense} from '@mattermost/types/config';
import type {PreferenceType} from '@mattermost/types/preferences';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getServerLimits} from 'mattermost-redux/selectors/entities/limits';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {AnnouncementBarTypes, Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    license?: ClientLicense;
    userIsAdmin: boolean;
};

const learnMoreExternalLink = 'https://mattermost.com/pl/error-code-error-safety-limits-exceeded';

function UsersLimitsAnnouncementBar(props: Props) {
    const dispatch = useDispatch();
    const serverLimits = useSelector(getServerLimits);
    const currentUser = useSelector(getCurrentUser);

    const handleCTAClick = useCallback(() => {
        window.open(learnMoreExternalLink, '_blank');
    }, []);

    const isLicensed = props?.license?.IsLicensed === 'true';
    const maxUsersLimit = serverLimits?.maxUsersLimit ?? 0;
    const maxUsersHardLimit = serverLimits?.maxUsersHardLimit ?? 0;
    const activeUserCount = serverLimits?.activeUserCount ?? 0;

    // Check if warning banner has been dismissed
    const warningDismissalKey = 'users_limits_warning';
    const isWarningDismissed = useSelector((state: GlobalState) => {
        return getPreference(state, Preferences.USERS_LIMITS_BANNER, warningDismissalKey, 'false') === 'true';
    });

    const handleWarningDismiss = useCallback(() => {
        if (currentUser?.id) {
            const preference: PreferenceType = {
                category: Preferences.USERS_LIMITS_BANNER,
                name: warningDismissalKey,
                user_id: currentUser.id,
                value: 'true',
            };
            dispatch(savePreferences(currentUser.id, [preference]));
        }
    }, [currentUser?.id, dispatch, warningDismissalKey]);

    // Critical state: activeUserCount >= hardLimit
    if (shouldShowCriticalBanner({userIsAdmin: props.userIsAdmin, isLicensed, maxUsersHardLimit, activeUserCount})) {
        return (
            <AnnouncementBar
                id='users_limits_announcement_bar_critical'
                showCloseButton={false}
                message={
                    <FormattedMessage
                        id='users_limits_announcement_bar.copyText'
                        defaultMessage='User limits exceeded. Contact administrator with: {ErrorCode}'
                        values={{
                            ErrorCode: 'ERROR_SAFETY_LIMITS_EXCEEDED',
                        }}
                    />
                }
                type={AnnouncementBarTypes.CRITICAL}
                icon={<AlertOutlineIcon size={16}/>}
                showCTA={true}
                showLinkAsButton={true}
                ctaText={
                    <FormattedMessage
                        id='users_limits_announcement_bar.ctaText'
                        defaultMessage='Learn More'
                    />
                }
                onButtonClick={handleCTAClick}
            />
        );
    }

    // Warning state: activeUserCount >= maxLimit && < hardLimit
    if (shouldShowWarningBanner({userIsAdmin: props.userIsAdmin, isLicensed, maxUsersLimit, maxUsersHardLimit, activeUserCount, isWarningDismissed})) {
        return (
            <AnnouncementBar
                id='users_limits_announcement_bar_warning'
                showCloseButton={true}
                handleClose={handleWarningDismiss}
                message={
                    <FormattedMessage
                        id='users_limits_announcement_bar.warning.copyText'
                        defaultMessage='This workspace is approaching the user limit ({activeUserCount}/{maxUsersHardLimit} users).'
                        values={{
                            activeUserCount,
                            maxUsersHardLimit,
                        }}
                    />
                }
                type='warning'
                icon={<AlertOutlineIcon size={16}/>}
                showCTA={true}
                showLinkAsButton={true}
                ctaText={
                    <FormattedMessage
                        id='users_limits_announcement_bar.ctaText'
                        defaultMessage='Learn More'
                    />
                }
                onButtonClick={handleCTAClick}
            />
        );
    }

    return null;
}

export type ShouldShowingUserLimitsAnnouncementBarProps = {
    userIsAdmin: boolean;
    isLicensed: boolean;
    maxUsersLimit?: number;
    maxUsersHardLimit: number;
    activeUserCount: number;
    isWarningDismissed?: boolean;
};

export function shouldShowCriticalBanner({userIsAdmin, isLicensed, maxUsersHardLimit, activeUserCount}: ShouldShowingUserLimitsAnnouncementBarProps) {
    if (!userIsAdmin) {
        return false;
    }

    if (maxUsersHardLimit === 0 || activeUserCount === 0) {
        return false;
    }

    return !isLicensed && activeUserCount >= maxUsersHardLimit;
}

export function shouldShowWarningBanner({userIsAdmin, isLicensed, maxUsersLimit = 0, maxUsersHardLimit, activeUserCount, isWarningDismissed}: ShouldShowingUserLimitsAnnouncementBarProps) {
    if (!userIsAdmin) {
        return false;
    }

    if (maxUsersLimit === 0 || maxUsersHardLimit === 0 || activeUserCount === 0) {
        return false;
    }

    if (isWarningDismissed) {
        return false;
    }

    // Show warning when users >= maxUsersLimit but < maxUsersHardLimit
    return !isLicensed && activeUserCount >= maxUsersLimit && activeUserCount < maxUsersHardLimit;
}

export default UsersLimitsAnnouncementBar;
