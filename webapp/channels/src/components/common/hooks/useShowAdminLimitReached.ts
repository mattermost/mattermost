// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// import React from 'react';
import {defineMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {setNeedsLoggedInLimitReachedCheck} from 'actions/views/admin';
import {closeModal, openModal} from 'actions/views/modals';
import {getNeedsLoggedInLimitReachedCheck} from 'selectors/views/admin';

import CloudUsageModal from 'components/cloud_usage_modal';

import {ModalIdentifiers, Preferences} from 'utils/constants';

import useGetLimits from './useGetLimits';
import useGetUsage from './useGetUsage';
import usePreference from './usePreference';

// intended to only be run for admins of cloud instances.
export default function useShowAdminLimitReached() {
    const usage = useGetUsage();
    const dispatch = useDispatch();
    const intl = useIntl();
    const [limits, limitsLoaded] = useGetLimits();
    const needsLoggedInLimitReachedCheck = useSelector(getNeedsLoggedInLimitReachedCheck);
    const messageLimit = limits?.messages?.history;
    const [shownLimitsReachedOnLogin, setShownLimitsReachedOnLogin] = usePreference(
        Preferences.CATEGORY_CLOUD_LIMITS,
        Preferences.SHOWN_LIMITS_REACHED_ON_LOGIN,
    );

    if (!limitsLoaded || !usage.messages.historyLoaded || messageLimit === undefined || !needsLoggedInLimitReachedCheck || shownLimitsReachedOnLogin === 'true') {
        return;
    }

    if (usage.messages.history > messageLimit) {
        setShownLimitsReachedOnLogin('true');
        dispatch(openModal({
            modalId: ModalIdentifiers.CLOUD_LIMITS,
            dialogType: CloudUsageModal,
            dialogProps: {
                title: defineMessage({
                    id: 'workspace_limits.modals.limits_reached.title',
                    defaultMessage: '{limitName} limit reached',
                    values: {
                        limitName: intl.formatMessage({
                            id: 'workspace_limits.modals.limits_reached.title.message_history',
                            defaultMessage: 'Message history',
                        }),
                    },
                }),
                description: defineMessage({
                    id: 'workspace_limits.modals.limits_reached.description.message_history',
                    defaultMessage: 'Your sent message history is no longer available but you can still send messages. Upgrade to a paid plan and get unlimited access to your message history.',
                }),
                secondaryAction: {
                    message: defineMessage({
                        id: 'workspace_limits.modals.close',
                        defaultMessage: 'Close',
                    }),
                    onClick: () => {
                        dispatch(closeModal(ModalIdentifiers.CLOUD_LIMITS));
                    },
                },
                primaryAction: {
                    message: defineMessage({
                        id: 'workspace_limits.modals.view_plan_options',
                        defaultMessage: 'View plan options',
                    }),
                    onClick: () => {
                        dispatch(closeModal(ModalIdentifiers.CLOUD_LIMITS));
                        trackEvent('admin_login_limit_reached_dashboard', 'click_open_pricing_page', {
                            callerInfo: 'admin_login_limit_reached_dashboard',
                        });
                        window.open('https://mattermost.com/pricing', '_blank', 'noopener,noreferrer');
                    },
                },
                onClose: () => {
                    dispatch(closeModal(ModalIdentifiers.CLOUD_LIMITS));
                },
                needsTheme: true,
            },
        }));
    }
    dispatch(setNeedsLoggedInLimitReachedCheck(false));
}
