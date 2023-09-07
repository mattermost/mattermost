// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Product} from '@mattermost/types/cloud';

import {Preferences} from 'mattermost-redux/constants';
import {getHasDismissedSystemConsoleLimitReached} from 'mattermost-redux/selectors/entities/preferences';

import AlertBanner from 'components/alert_banner';
import useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import {useSaveBool} from 'components/common/hooks/useSavePreferences';

import {CloudProducts} from 'utils/constants';
import {anyUsageDeltaExceededLimit} from 'utils/limits';

import './limit_reached_banner.scss';

interface Props {
    product?: Product;
}

const LimitReachedBanner = (props: Props) => {
    const intl = useIntl();
    const someLimitExceeded = anyUsageDeltaExceededLimit(useGetUsageDeltas());

    const hasDismissedBanner = useSelector(getHasDismissedSystemConsoleLimitReached);

    const [openSalesLink] = useOpenSalesLink();
    const openPricingModal = useOpenPricingModal();
    const saveBool = useSaveBool();
    if (hasDismissedBanner || !someLimitExceeded || !props.product || (props.product.sku !== CloudProducts.STARTER)) {
        return null;
    }

    const title = (
        <FormattedMessage
            id='workspace_limits.banner_upgrade.free'
            defaultMessage='Upgrade to one of our paid plans to avoid {planName} plan data limits'
            values={{
                planName: props.product.name,
            }}
        />
    );

    const description = (
        <FormattedMessage
            id='workspace_limits.banner_upgrade_reason.free'
            defaultMessage='Your workspace has exceeded {planName} plan data limits. Upgrade to a paid plan for additional capacity.'
            values={{
                planName: props.product.name,
            }}
        />
    );

    const upgradeMessage = {
        id: 'workspace_limits.modals.view_plans',
        defaultMessage: 'View plans',
    };

    const upgradeAction = () => openPricingModal({trackingLocation: 'limit_reached_banner'});

    const onDismiss = () => {
        saveBool({
            category: Preferences.CATEGORY_UPGRADE_CLOUD,
            name: Preferences.SYSTEM_CONSOLE_LIMIT_REACHED,
            value: true,
        });
    };

    return (
        <AlertBanner
            mode='danger'
            title={title}
            message={description}
            onDismiss={onDismiss}
            className='LimitReachedBanner'
        >
            <div className='LimitReachedBanner__actions'>
                <button
                    onClick={upgradeAction}
                    className='btn LimitReachedBanner__primary'
                >
                    {intl.formatMessage(upgradeMessage)}
                </button>
                <button
                    onClick={openSalesLink}
                    className='btn LimitReachedBanner__contact-sales'
                >
                    {intl.formatMessage({
                        id: 'admin.license.trialCard.contactSales',
                        defaultMessage: 'Contact sales',
                    })}
                </button>
            </div>
        </AlertBanner>
    );
};

export default LimitReachedBanner;
