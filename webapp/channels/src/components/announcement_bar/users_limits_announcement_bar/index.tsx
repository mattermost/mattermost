// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {ExclamationThickIcon} from '@mattermost/compass-icons/components';
import type {ClientLicense} from '@mattermost/types/config';

import {getUsersLimits} from 'mattermost-redux/selectors/entities/limits';

import {openModal} from 'actions/views/modals';

import AirGappedContactSalesModal from 'components/air_gapped_contact_sales_modal';
import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';
import useCWSAvailabilityCheck, {CSWAvailabilityCheckTypes} from 'components/common/hooks/useCWSAvailabilityCheck';

import {
    AnnouncementBarTypes,
    LicenseLinks,
    ModalIdentifiers,
} from 'utils/constants';

type Props = {
    license?: ClientLicense;
    userIsAdmin: boolean;
};

function UsersLimitsAnnouncementBar(props: Props) {
    const dispatch = useDispatch();

    const {formatMessage} = useIntl();

    const cwsAvailability = useCWSAvailabilityCheck();
    const usersLimits = useSelector(getUsersLimits);

    const handleCTAClick = useCallback(() => {
        if (
            cwsAvailability === CSWAvailabilityCheckTypes.Available ||
            cwsAvailability === CSWAvailabilityCheckTypes.NotApplicable
        ) {
            window.open(LicenseLinks.CONTACT_SALES, '_blank');
        } else if (cwsAvailability === CSWAvailabilityCheckTypes.Unavailable) {
            // Its an airgapped instance
            dispatch(openModal({
                modalId: ModalIdentifiers.AIR_GAPPED_CONTACT_SALES,
                dialogType: AirGappedContactSalesModal,
            }));
        }
    }, [cwsAvailability]);

    const isLicensed = props?.license?.IsLicensed === 'true';
    const maxUsersLimit = usersLimits?.maxUsersLimit ?? 0;
    const activeUserCount = usersLimits?.activeUserCount ?? 0;

    console.log('UsersLimitsAnnouncementBar', {isLicensed, maxUsersLimit, activeUserCount});

    if (!shouldShowUserLimitsAnnouncementBar({userIsAdmin: props.userIsAdmin, isLicensed, maxUsersLimit, activeUserCount})) {
        return null;
    }

    return (
        <AnnouncementBar
            id='users_limits_announcement_bar'
            showCloseButton={false}
            message={formatMessage({
                id: 'users_limits_announcement_bar.copyText',
                defaultMessage: 'Your user count exceeds the maximum users allowed. Upgrade to Mattermost Professional or Mattermost Enterprise to continue using Mattermost.',
            })}
            type={AnnouncementBarTypes.CRITICAL}
            icon={<ExclamationThickIcon size={16}/>} // Icon to be fa-exclamation-triangle
            showCTA={true}
            ctaDisabled={cwsAvailability === CSWAvailabilityCheckTypes.Pending}
            showLinkAsButton={true}
            ctaText={formatMessage({
                id: 'users_limits_announcement_bar.ctaText',
                defaultMessage: 'Contact sales',
            })}
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

    if (!isLicensed && maxUsersLimit <= 10001) {
        return true;
    }

    return false;
}

export default UsersLimitsAnnouncementBar;
