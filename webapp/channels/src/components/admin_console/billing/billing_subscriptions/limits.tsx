// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    getCloudProducts,
    getCloudSubscription,
    getSubscriptionProduct,
} from 'mattermost-redux/selectors/entities/cloud';

import {CloudProducts} from 'utils/constants';
import {asGBString, fallbackStarterLimits, hasSomeLimits} from 'utils/limits';

import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import LimitCard from './limit_card';

import './limits.scss';

const Limits = (): JSX.Element | null => {
    const intl = useIntl();
    const subscription = useSelector(getCloudSubscription);
    const products = useSelector(getCloudProducts);
    const subscriptionProduct = useSelector(getSubscriptionProduct);
    const [cloudLimits, limitsLoaded] = useGetLimits();
    const usage = useGetUsage();
    const [openSalesLink] = useOpenSalesLink();
    const openPricingModal = useOpenPricingModal();

    if (!subscriptionProduct || !limitsLoaded || !hasSomeLimits(cloudLimits)) {
        return null;
    }

    let title: React.ReactNode = null;
    let description: React.ReactNode = null;
    let currentUsage: React.ReactNode = null;
    if (subscriptionProduct.sku === CloudProducts.STARTER) {
        title = (
            <FormattedMessage
                id='workspace_limits.upgrade'
                defaultMessage='Upgrade to avoid {planName} data limits'
                values={{
                    planName: products?.[subscription?.product_id || '']?.name || 'Unknown product',
                }}
            />
        );
        description = intl.formatMessage(
            {
                id: 'workspace_limits.upgrade_reasons.free',
                defaultMessage: '{planName} is restricted to {messagesLimit} message history and {storageLimit} file storage. You can delete items to free up space or upgrade to a paid plan.',
            },
            {
                planName: subscriptionProduct.name,
                messagesLimit: intl.formatNumber(cloudLimits?.messages?.history || fallbackStarterLimits.messages.history),
                storageLimit: asGBString(cloudLimits?.files?.total_storage || fallbackStarterLimits.files.totalStorage, intl.formatNumber),
            },
        );
        currentUsage = (
            <div className='ProductLimitsPanel__limits'>
                {cloudLimits?.files?.total_storage && (
                    <LimitCard
                        name={(
                            <FormattedMessage
                                id='workspace_limits.file_storage'
                                defaultMessage='File Storage'
                            />
                        )}
                        status={(
                            <FormattedMessage
                                id='workspace_limits.file_storage.usage'
                                defaultMessage='{actual} of {limit} ({percent}%)'
                                values={{
                                    actual: asGBString(usage.files.totalStorage, intl.formatNumber),
                                    limit: asGBString(cloudLimits.files.total_storage, intl.formatNumber),
                                    percent: Math.floor((usage.files.totalStorage / cloudLimits.files.total_storage) * 100),

                                }}
                            />
                        )}
                        percent={Math.floor((usage.files.totalStorage / cloudLimits.files.total_storage) * 100)}
                        icon='icon-folder-outline'
                    />
                )}
                {cloudLimits?.messages?.history && (
                    <LimitCard
                        name={
                            <FormattedMessage
                                id='workspace_limits.message_history'
                                defaultMessage='Message History'
                            />
                        }
                        status={
                            <FormattedMessage
                                id='workspace_limits.message_history.usage'
                                defaultMessage='{actual} of {limit} ({percent}%)'
                                values={{
                                    actual: `${Math.floor(usage.messages.history / 1000)}K`,
                                    limit: `${Math.floor(cloudLimits.messages.history / 1000)}K`,
                                    percent: Math.floor((usage.messages.history / cloudLimits.messages.history) * 100),
                                }}
                            />
                        }
                        percent={Math.floor((usage.messages.history / cloudLimits.messages.history) * 100)}
                        icon='icon-message-text-outline'
                    />
                )}
            </div>
        );
    }

    const panelClassname = 'ProductLimitsPanel';
    const actionsClassname = 'ProductLimitsPanel__actions';
    return (
        <div className={panelClassname}>
            {title && (
                <div
                    data-testid='limits-panel-title'
                    className='ProductLimitsPanel__title'
                >
                    {title}
                </div>
            )}
            {description && <div className='ProductLimitsPanel__description'>
                {description}
            </div>}
            {currentUsage}
            <div className={actionsClassname}>
                {subscriptionProduct.sku === CloudProducts.STARTER && (
                    <>
                        <button
                            onClick={() => openPricingModal({trackingLocation: 'billing_subscriptions_limits_dashboard'})}
                            className='btn btn-primary'
                        >
                            {intl.formatMessage({
                                id: 'workspace_limits.modals.view_plan_options',
                                defaultMessage: 'View plan options',
                            })}
                        </button>
                        <button
                            onClick={openSalesLink}
                            className='btn btn-secondary'
                        >
                            {intl.formatMessage({
                                id: 'admin.license.trialCard.contactSales',
                                defaultMessage: 'Contact sales',
                            })}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default Limits;
