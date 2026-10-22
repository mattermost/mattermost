// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';
import type {PreferenceType} from '@mattermost/types/preferences';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getServerLimits} from 'mattermost-redux/selectors/entities/limits';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {AnnouncementBarTypes, LicenseLinks, LicenseSkus, Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    userIsAdmin: boolean;
};

function SingleChannelGuestLimitBanner(props: Props) {
    const dispatch = useDispatch();
    const license = useSelector(getLicense);
    const serverLimits = useSelector(getServerLimits);
    const currentUser = useSelector(getCurrentUser);

    const dismissalKey = 'single_channel_guest_limit';
    const isDismissed = useSelector((state: GlobalState) => {
        return getPreference(state, Preferences.SINGLE_CHANNEL_GUEST_LIMIT_BANNER, dismissalKey, 'false') === 'true';
    });

    const handleDismiss = useCallback(() => {
        if (currentUser?.id) {
            const preference: PreferenceType = {
                category: Preferences.SINGLE_CHANNEL_GUEST_LIMIT_BANNER,
                name: dismissalKey,
                user_id: currentUser.id,
                value: 'true',
            };
            dispatch(savePreferences(currentUser.id, [preference]));
        }
    }, [currentUser?.id, dispatch]);

    const config = useSelector(getConfig);
    const isEntrySku = license.SkuShortName === LicenseSkus.Entry;
    const guestAccountsEnabled = config?.EnableGuestAccounts === 'true';

    const singleChannelGuestCount = serverLimits?.singleChannelGuestCount ?? 0;
    const singleChannelGuestLimit = serverLimits?.singleChannelGuestLimit ?? 0;

    if (!props.userIsAdmin || isDismissed || isEntrySku || !guestAccountsEnabled || singleChannelGuestLimit === 0 || singleChannelGuestCount <= singleChannelGuestLimit) {
        return null;
    }

    return (
        <AnnouncementBar
            id='single_channel_guest_limit_banner'
            showCloseButton={true}
            handleClose={handleDismiss}
            message={
                <FormattedMessage
                    id='single_channel_guest_limit_banner.message'
                    defaultMessage='Your workspace has reached the limit for single-channel guests'
                />
            }
            type={AnnouncementBarTypes.CRITICAL}
            icon={<AlertOutlineIcon size={16}/>}
            showCTA={true}
            showLinkAsButton={true}
            ctaText={
                <FormattedMessage
                    id='single_channel_guest_limit_banner.cta'
                    defaultMessage='Contact sales'
                />
            }
            onButtonClick={() => window.open(LicenseLinks.CONTACT_SALES, '_blank')}
        />
    );
}

export default SingleChannelGuestLimitBanner;
