// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {isCurrentLicenseCloud, getSubscriptionProduct as selectSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {get as selectPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import AlertBanner from 'components/alert_banner';
import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import NotifyAdminCTA from 'components/notify_admin_cta/notify_admin_cta';
import Tooltip from 'components/tooltip';

import {CloudProducts, LicenseSkus, MattermostFeatures, Preferences} from 'utils/constants';
import {asGBString} from 'utils/limits';

import type {GlobalState} from 'types/store';

interface FileLimitSnoozePreference {
    lastSnoozeTimestamp: number;
}

const snoozeCoolOffDays = 10;
const snoozeCoolOffDaysMillis = snoozeCoolOffDays * 24 * 60 * 60 * 1000;

const StyledDiv = styled.div`
width: 100%;
padding: 0 24px;
margin: 12px auto;
`;

function FileLimitStickyBanner() {
    const [show, setShow] = useState(true);
    const {formatMessage, formatNumber} = useIntl();
    const dispatch = useDispatch();

    const usage = useGetUsage();
    const [cloudLimits] = useGetLimits();
    const openPricingModal = useOpenPricingModal();

    const user = useSelector(getCurrentUser);
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const isCloud = useSelector(isCurrentLicenseCloud);
    const product = useSelector(selectSubscriptionProduct);
    const isStarter = product?.sku === CloudProducts.STARTER;

    const snoozePreferenceVal = useSelector((state: GlobalState) => selectPreference(state, Preferences.CLOUD_USER_EPHEMERAL_INFO, 'file_limit_banner_snooze'));

    let shouldShowAgain = true;
    if (snoozePreferenceVal !== '') {
        const snoozeInfo = JSON.parse(snoozePreferenceVal) as FileLimitSnoozePreference;
        const timeDiff = Date.now() - snoozeInfo.lastSnoozeTimestamp;
        shouldShowAgain = timeDiff >= snoozeCoolOffDaysMillis;
    }

    if (!show) {
        return null;
    }

    if (!shouldShowAgain) {
        return null;
    }

    if (!isCloud || !isStarter) {
        return null;
    }

    const fileStorageLimit = cloudLimits?.files?.total_storage;
    const currentFileStorageUsage = usage.files.totalStorage;
    if ((fileStorageLimit === undefined) || !(currentFileStorageUsage > fileStorageLimit)) {
        return null;
    }

    const snoozeBanner = () => {
        const fileLimitBannerSnoozeInfo: FileLimitSnoozePreference = {
            lastSnoozeTimestamp: Date.now(),
        };

        dispatch(savePreferences(user.id, [
            {
                category: Preferences.CLOUD_USER_EPHEMERAL_INFO,
                name: 'file_limit_banner_snooze',
                user_id: user.id,
                value: JSON.stringify(fileLimitBannerSnoozeInfo),
            },
        ]));

        setShow(false);
    };

    const title = (
        <FormattedMessage
            id={'create_post.file_limit_sticky_banner.messageTitle'}
            defaultMessage={'Your free plan is limited to {storageGB} of files.'}
            values={{
                storageGB: asGBString(fileStorageLimit, formatNumber),
            }}
        />
    );

    const adminMessage =
        (
            <FormattedMessage
                id={'create_post.file_limit_sticky_banner.admin_message'}
                defaultMessage={'New uploads will automatically archive older files. To view them again, you can delete older files or <a>upgrade to a paid plan.</a>'}
                values={{
                    a: (chunks: React.ReactNode) => {
                        return (
                            <a
                                onClick={
                                    (e) => {
                                        e.preventDefault();
                                        openPricingModal({trackingLocation: 'file_limit_sticky_banner'});
                                    }
                                }
                            >{chunks}</a>
                        );
                    },
                }}
            />
        );

    const nonAdminMessage =
        (
            <FormattedMessage
                id={'create_post.file_limit_sticky_banner.non_admin_message'}
                defaultMessage={'New uploads will automatically archive older files. To view them again, <a>notify your admin to upgrade to a paid plan.</a>'}
                values={{
                    a: (chunks: React.ReactNode) => (
                        <NotifyAdminCTA
                            ctaText={chunks}
                            notifyRequestData={{
                                required_plan: LicenseSkus.Professional,
                                required_feature: MattermostFeatures.UNLIMITED_FILE_STORAGE,
                                trial_notification: false,
                            }}
                            callerInfo='file_limit_sticky_banner'
                        />),
                }}
            />
        );

    const tooltip = (
        <Tooltip id='file_limit_banner_snooze'>
            {formatMessage({id: 'create_post.file_limit_sticky_banner.snooze_tooltip', defaultMessage: 'Snooze for {snoozeDays} days'}, {snoozeDays: snoozeCoolOffDays})}
        </Tooltip>
    );

    return (
        <StyledDiv id='cloud_file_limit_banner'>
            <AlertBanner
                mode={'warning'}
                variant={'app'}
                onDismiss={snoozeBanner}
                closeBtnTooltip={tooltip}
                title={title}
                message={isAdmin ? adminMessage : nonAdminMessage}
            />
        </StyledDiv>
    );
}

export default FileLimitStickyBanner;
