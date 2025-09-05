// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useState} from 'react';
import {defineMessages} from 'react-intl';

import type {NotifyAdminRequest} from '@mattermost/types/cloud';

import {Client4} from 'mattermost-redux/client';

import {trackEvent} from 'actions/telemetry_actions';

export const NotifyStatus = {
    NotStarted: 'NOT_STARTED',
    Started: 'STARTED',
    Success: 'SUCCESS',
    Failed: 'FAILED',
    AlreadyComplete: 'COMPLETE',
} as const;

export type NotifyStatusValues = ValueOf<typeof NotifyStatus>;

type ValueOf<T> = T[keyof T];

type UseNotifyAdminArgs = {
    ctaText?: {
        id: string;
        defaultMessage: string;
    };
}

type NotifyAdminArgs = {
    requestData: NotifyAdminRequest;
    trackingArgs: {
        category: any;
        event: any;
        props?: any;
    };
}

const messages = defineMessages({
    [NotifyStatus.Started]: {
        id: 'notify_admin_to_upgrade_cta.notify-admin.notifying',
        defaultMessage: 'Notifying...',
    },
    [NotifyStatus.Success]: {
        id: 'notify_admin_to_upgrade_cta.notify-admin.notified',
        defaultMessage: 'Admin notified!',
    },
    [NotifyStatus.AlreadyComplete]: {
        id: 'notify_admin_to_upgrade_cta.notify-admin.already_notified',
        defaultMessage: 'Already notified!',
    },
    [NotifyStatus.Failed]: {
        id: 'notify_admin_to_upgrade_cta.notify-admin.failed',
        defaultMessage: 'Try again later!',
    },
    [NotifyStatus.NotStarted]: {
        id: 'notify_admin_to_upgrade_cta.notify-admin.notify',
        defaultMessage: 'Notify your admin',
    },
});

export const useGetNotifyAdmin = (args: UseNotifyAdminArgs) => {
    const [notifyStatus, setStatus] = useState<ValueOf<typeof NotifyStatus>>(NotifyStatus.NotStarted);

    const btnText = useCallback((status: ValueOf<typeof NotifyStatus>): {id: string; defaultMessage: string} => {
        if (args.ctaText && status === NotifyStatus.NotStarted) {
            return args.ctaText;
        }
        return messages[status];
    }, [args.ctaText]);

    const notifyAdmin = useCallback(async ({requestData, trackingArgs}: NotifyAdminArgs) => {
        try {
            setStatus(NotifyStatus.Started);
            await Client4.notifyAdmin(requestData);
            trackEvent(trackingArgs.category, trackingArgs.event, trackingArgs.props);
            setStatus(NotifyStatus.Success);
        } catch (error) {
            if (error && error.status_code === 403) {
                setStatus(NotifyStatus.AlreadyComplete);
            } else {
                setStatus(NotifyStatus.Failed);
            }
        }
    }, []);

    return {
        notifyStatus,
        btnText,
        notifyAdmin,
    };
};
