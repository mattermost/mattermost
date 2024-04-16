// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';
import type {ClientLicense} from '@mattermost/types/config';

import {getServerLimits} from 'mattermost-redux/selectors/entities/limits';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {AnnouncementBarTypes} from 'utils/constants';

type Props = {
    license?: ClientLicense;
    userIsAdmin: boolean;
};

const learnMoreExternalLink = 'https://mattermost.com/pl/error-code-error-safety-limits-exceeded';

function PostLimitsAnnouncementBar(props: Props) {
    const serverLimits = useSelector(getServerLimits);

    const handleCTAClick = useCallback(() => {
        window.open(learnMoreExternalLink, '_blank');
    }, []);

    const isLicensed = props?.license?.IsLicensed === 'true';
    const maxPostLimit = serverLimits?.maxPostLimit ?? 0;
    const postCount = serverLimits?.postCount ?? 0;

    if (!shouldShowPostLimitsAnnouncementBar({userIsAdmin: props.userIsAdmin, isLicensed, maxPostLimit, postCount})) {
        return null;
    }

    return (
        <AnnouncementBar
            id='post_limits_announcement_bar'
            showCloseButton={false}
            message={
                <FormattedMessage
                    id='post_limits_announcement_bar.copyText'
                    defaultMessage='Message limits exceeded. Contact administrator with: {ErrorCode}'
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

export type ShouldShowingPostLimitsAnnouncementBarProps = {
    userIsAdmin: boolean;
    isLicensed: boolean;
    maxPostLimit: number;
    postCount: number;
};

export function shouldShowPostLimitsAnnouncementBar({userIsAdmin, isLicensed, maxPostLimit, postCount}: ShouldShowingPostLimitsAnnouncementBarProps) {
    if (!userIsAdmin) {
        return false;
    }

    if (maxPostLimit === 0 || postCount === 0) {
        return false;
    }

    return !isLicensed && postCount >= maxPostLimit;
}

export default PostLimitsAnnouncementBar;
