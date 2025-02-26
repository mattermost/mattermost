// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PrimitiveType, FormatXMLElementFn} from 'intl-messageformat';
import React from 'react';
import type {ReactNode} from 'react';
import {defineMessage, useIntl} from 'react-intl';

import type {LimitSummary} from 'components/common/hooks/useGetHighestThresholdCloudLimit';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import NotifyAdminCTA from 'components/notify_admin_cta/notify_admin_cta';

import {MattermostFeatures, LicenseSkus} from 'utils/constants';
import {limitThresholds, asGBString, inK, LimitTypes} from 'utils/limits';

interface Words {
    title: React.ReactNode;
    description: React.ReactNode;
    status: React.ReactNode;
}

export default function useWords(highestLimit: LimitSummary | false, isAdminUser: boolean, callerInfo: string): Words | false {
    const intl = useIntl();
    const openPricingModal = useOpenPricingModal();
    if (!highestLimit) {
        return false;
    }
    const usageRatio = (highestLimit.usage / highestLimit.limit) * 100;

    let callToAction = intl.formatMessage({
        id: 'workspace_limits.menu_limit.view_plans',
        defaultMessage: 'View plans',
    });

    if (isAdminUser) {
        callToAction = intl.formatMessage({
            id: 'workspace_limits.menu_limit.view_upgrade_options',
            defaultMessage: 'View upgrade options.',
        });
    }

    const values: Record<string, PrimitiveType | FormatXMLElementFn<string, string> | ((chunks: React.ReactNode | React.ReactNodeArray) => JSX.Element)> = {
        callToAction,
        a: (chunks: React.ReactNode | React.ReactNodeArray) => (
            <a
                id='view_plans_cta'
                onClick={() => openPricingModal({trackingLocation: callerInfo})}
            >
                {chunks}
            </a>),

    };

    let featureToNotifyOn = '';
    switch (highestLimit.id) {
    case LimitTypes.messageHistory:
        featureToNotifyOn = MattermostFeatures.UNLIMITED_MESSAGES;
        break;
    case LimitTypes.fileStorage:
        featureToNotifyOn = MattermostFeatures.UNLIMITED_FILE_STORAGE;
        break;
    default:
        break;
    }

    if (!isAdminUser && (usageRatio >= limitThresholds.danger || usageRatio >= limitThresholds.exceeded)) {
        values.callToAction = intl.formatMessage({
            id: 'workspace_limits.menu_limit.notify_admin',
            defaultMessage: 'Notify admin',
        });
        values.a = (chunks: React.ReactNode | React.ReactNodeArray) => (
            <NotifyAdminCTA
                ctaText={chunks}
                callerInfo={callerInfo}
                notifyRequestData={{
                    required_feature: featureToNotifyOn,
                    required_plan: LicenseSkus.Professional,
                    trial_notification: false}}
            />);
    }

    switch (highestLimit.id) {
    case LimitTypes.messageHistory: {
        let description = defineMessage({
            id: 'workspace_limits.menu_limit.warn.messages_history',
            defaultMessage: 'You’re getting closer to the free {limit} message limit. <a>{callToAction}</a>',
        });
        values.limit = intl.formatNumber(highestLimit.limit);
        if (usageRatio >= limitThresholds.danger) {
            if (isAdminUser) {
                description = defineMessage({
                    id: 'workspace_limits.menu_limit.critical.messages_history',
                    defaultMessage: 'You’re close to hitting the free {limit} message history limit <a>{callToAction}</a>',
                });
            } else {
                description = defineMessage({
                    id: 'workspace_limits.menu_limit.critical.messages_history_non_admin',
                    defaultMessage: 'You\'re almost at the message limit. Your admin can upgrade your plan for unlimited messages. <a>{callToAction}</a>',
                });
            }
        }
        if (usageRatio >= limitThresholds.reached) {
            if (isAdminUser) {
                description = defineMessage({
                    id: 'workspace_limits.menu_limit.reached.messages_history',
                    defaultMessage: 'You’ve reached the free message history limit. You can only view up to the last {limit} messages in your history. <a>{callToAction}</a>',
                });
                values.limit = inK(highestLimit.limit);
            } else {
                description = defineMessage({
                    id: 'workspace_limits.menu_limit.reached.messages_history_non_admin',
                    defaultMessage: 'You’ve reached your message limit. Your admin can upgrade your plan for unlimited messages. <a>{callToAction}</a>',
                });
            }
        }
        if (usageRatio >= limitThresholds.exceeded) {
            if (isAdminUser) {
                description = defineMessage({
                    id: 'workspace_limits.menu_limit.over.messages_history',
                    defaultMessage: 'You’re over the free message history limit. You can only view up to the last {limit} messages in your history. <a>{callToAction}</a>',
                });
                values.limit = inK(highestLimit.limit);
            } else {
                description = defineMessage({
                    id: 'workspace_limits.menu_limit.over.messages_history_non_admin',
                    defaultMessage: 'You\'re over your message limit. Your admin can upgrade your plan for unlimited messages. <a>{callToAction}</a>',
                });
            }
        }
        return {
            title: intl.formatMessage({
                id: 'workspace_limits.menu_limit.messages',
                defaultMessage: 'Total messages',
            }),
            description: intl.formatMessage<ReactNode>(
                description,
                values,
            ),
            status: inK(highestLimit.usage),
        };
    }
    case LimitTypes.fileStorage: {
        let description = defineMessage({
            id: 'workspace_limits.menu_limit.warn.files_storage',
            defaultMessage: 'You’re getting closer to the {limit} file storage limit. <a>{callToAction}</a>',
        });
        values.limit = asGBString(highestLimit.limit, intl.formatNumber);
        if (usageRatio >= limitThresholds.danger) {
            description = defineMessage({
                id: 'workspace_limits.menu_limit.critical.files_storage',
                defaultMessage: 'You’re getting closer to the {limit} file storage limit. <a>{callToAction}</a>',
            });
        }
        if (usageRatio >= limitThresholds.reached) {
            description = defineMessage({
                id: 'workspace_limits.menu_limit.reached.files_storage',
                defaultMessage: 'You’ve reached the {limit} file storage limit. You can only access the most recent {limit} worth of files. <a>{callToAction}</a>',
            });
        }
        if (usageRatio >= limitThresholds.exceeded) {
            description = defineMessage({
                id: 'workspace_limits.menu_limit.over.files_storage',
                defaultMessage: 'You’re over the {limit} file storage limit. You can only access the most recent {limit} worth of files. <a>{callToAction}</a>',
            });
        }

        return {
            title: intl.formatMessage({
                id: 'workspace_limits.menu_limit.file_storage',
                defaultMessage: 'File storage limit',
            }),
            description: intl.formatMessage<ReactNode>(
                description,
                values,
            ),
            status: asGBString(highestLimit.usage, intl.formatNumber),
        };
    }
    default:
        return false;
    }
}
