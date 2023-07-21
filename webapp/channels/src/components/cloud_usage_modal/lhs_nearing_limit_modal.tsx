// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {closeModal} from 'actions/views/modals';
import {getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';

import useGetHighestThresholdCloudLimit from 'components/common/hooks/useGetHighestThresholdCloudLimit';
import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import {ModalIdentifiers} from 'utils/constants';
import {t, Message} from 'utils/i18n';
import {fallbackStarterLimits, asGBString, LimitTypes} from 'utils/limits';

import CloudUsageModal from './index';

export default function LHSNearingLimitsModal() {
    const dispatch = useDispatch();
    const product = useSelector(getSubscriptionProduct);
    const usage = useGetUsage();
    const intl = useIntl();
    const openPricingModal = useOpenPricingModal();

    const [limits] = useGetLimits();

    const primaryAction = {
        message: {
            id: t('workspace_limits.modals.view_plans'),
            defaultMessage: 'View plans',
        },
        onClick: () => openPricingModal({trackingLocation: 'cloud_usage_lhs_nearing_limit_modal'}),
    };
    const secondaryAction = {
        message: {
            id: t('workspace_limits.modals.close'),
            defaultMessage: 'Close',
        },
        onClick: () => {
            dispatch(closeModal(ModalIdentifiers.CLOUD_LIMITS));
        },
    };
    const highestLimit = useGetHighestThresholdCloudLimit(usage, limits);
    let title: Message = {
        id: t('workspace_limits.modals.informational.title'),
        defaultMessage: '{planName} limits',
        values: {
            planName: product?.name,
        },
    };

    let description: Message = {
        id: t('workspace_limits.modals.informational.description.freeLimits'),
        defaultMessage: '{planName} is restricted to {messages} message history and {storage} file storage.',
        values: {
            planName: product?.name,
            messages: intl.formatNumber(limits?.messages?.history ?? fallbackStarterLimits.messages.history),
            storage: asGBString(limits?.files?.total_storage ?? fallbackStarterLimits.files.totalStorage, intl.formatNumber),
        },
    };

    if (highestLimit && highestLimit.id === LimitTypes.messageHistory) {
        title = {
            id: t('workspace_limits.modals.limits_reached.title.message_history'),
            defaultMessage: 'Message history',
        };

        description = {
            id: t('workspace_limits.modals.limits_reached.description.message_history'),
            defaultMessage: 'Your sent message history is no longer available but you can still send messages. Upgrade to a paid plan and get unlimited access to your message history.',
        };
    }

    return (
        <CloudUsageModal
            title={title}
            description={description}
            primaryAction={primaryAction}
            secondaryAction={secondaryAction}
            onClose={() => {
                dispatch(closeModal(ModalIdentifiers.CLOUD_LIMITS));
            }}
        />
    );
}
