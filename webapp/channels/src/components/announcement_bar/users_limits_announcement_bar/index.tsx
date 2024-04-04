// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';
import type {ClientLicense} from '@mattermost/types/config';

import {getUsersLimits} from 'mattermost-redux/selectors/entities/limits';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {AnnouncementBarTypes} from 'utils/constants';

type Props = {
    license?: ClientLicense;
    userIsAdmin: boolean;
};

const learnMoreExternalLink = 'https://mattermost.com/pl/error-code-error-safety-limits-exceeded';

function UsersLimitsAnnouncementBar(props: Props) {
    const usersLimits = useSelector(getUsersLimits);

    const handleCTAClick = useCallback(() => {
        window.open(learnMoreExternalLink, '_blank');
    }, []);

    const isLicensed = props?.license?.IsLicensed === 'true';
    const maxUsersLimit = usersLimits?.maxUsersLimit ?? 0;
    const activeUserCount = usersLimits?.activeUserCount ?? 0;

    if (!shouldShowUserLimitsAnnouncementBar({userIsAdmin: props.userIsAdmin, isLicensed, maxUsersLimit, activeUserCount})) {
        return null;
    }

    return (
        <AnnouncementBar
            id='users_limits_announcement_bar'
            showCloseButton={false}
            message={
                <FormattedMessage
                    id='users_limits_announcement_bar.copyText'
                    defaultMessage='User limits exceeded. Contact administrator with: ERROR_SAFETY_LIMITS_EXCEEDED'
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

export type ShouldShowingUserLimitsAnnouncementBarProps = {
    userIsAdmin: boolean;
    isLicensed: boolean;
    maxUsersLimit: number;
    activeUserCount: number;
};

export function shouldShowUserLimitsAnnouncementBar({userIsAdmin, isLicensed, maxUsersLimit, activeUserCount}: ShouldShowingUserLimitsAnnouncementBarProps) {
    if (!userIsAdmin) {
        return false;
    }

    if (maxUsersLimit === 0 || activeUserCount === 0) {
        return false;
    }

    return !isLicensed && activeUserCount >= maxUsersLimit;
}

export default UsersLimitsAnnouncementBar;
