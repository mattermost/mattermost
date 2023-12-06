// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import type {Product} from '@mattermost/types/cloud';

import {getCloudProducts} from 'mattermost-redux/selectors/entities/cloud';

import {openModal, closeModal} from 'actions/views/modals';

import CloudUsageModal from 'components/cloud_usage_modal';
import useGetLimits from 'components/common/hooks/useGetLimits';

import {CloudProducts, ModalIdentifiers} from 'utils/constants';
import {t} from 'utils/i18n';
import {fallbackStarterLimits, asGBString, hasSomeLimits} from 'utils/limits';

const Disclaimer = styled.div`
margin-bottom: 8px;
color: var(--error-text);
font-family: 'Open Sans';
font-size: 12px;
font-style: normal;
font-weight: 600;
line-height: 16px;
cursor: pointer;
`;

function StarterDisclaimerCTA() {
    const intl = useIntl();
    const dispatch = useDispatch();
    const [limits] = useGetLimits();
    const products = useSelector(getCloudProducts);
    const starterProductName = Object.values(products || {})?.find((product: Product) => product?.sku === CloudProducts.STARTER)?.name || 'Cloud Free';

    if (!hasSomeLimits(limits)) {
        return null;
    }

    const openLimitsMiniModal = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CLOUD_LIMITS,
            dialogType: CloudUsageModal,
            dialogProps: {
                backdropClassName: 'cloud-usage-backdrop',
                title: {
                    id: t('workspace_limits.modals.informational.title'),
                    defaultMessage: '{planName} limits',
                    values: {
                        planName: starterProductName,
                    },
                },
                description: {
                    id: t('workspace_limits.modals.informational.description.freeLimits'),
                    defaultMessage: '{planName} is restricted to {messages} message history and {storage} file storage.',
                    values: {
                        planName: starterProductName,
                        messages: intl.formatNumber(fallbackStarterLimits.messages.history),
                        storage: asGBString(fallbackStarterLimits.files.totalStorage, intl.formatNumber),
                    },
                },
                secondaryAction: {
                    message: {
                        id: t('workspace_limits.modals.close'),
                        defaultMessage: 'Close',
                    },
                    onClick: () => {
                        dispatch(closeModal(ModalIdentifiers.CLOUD_LIMITS));
                    },
                },
                onClose: () => {
                    dispatch(closeModal(ModalIdentifiers.CLOUD_LIMITS));
                },
                ownLimits: {
                    messages: {
                        history: fallbackStarterLimits.messages.history,
                    },
                    files: {
                        total_storage: fallbackStarterLimits.files.totalStorage,
                    },
                },
                needsTheme: true,
            },
        }));
    };
    return (
        <Disclaimer
            id='free_plan_data_restrictions_cta'
            onClick={openLimitsMiniModal}
        >
            <i className='icon-alert-outline'/>
            {intl.formatMessage({id: 'pricing_modal.planDisclaimer.free', defaultMessage: 'This plan has data restrictions.'})}
        </Disclaimer>
    );
}

export default StarterDisclaimerCTA;
