// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {sendTestNotification} from 'actions/notification_actions';

import SectionNotice from 'components/section_notice';

const sectionNoticeContainerStyle: React.CSSProperties = {marginTop: 20};

const onGoToNotificationDocumentation = () => {
    window.open('https://docs.mattermost.com/collaborate/mention-people.html');
};

const TIME_TO_SENDING = 500;
const TIME_TO_SEND = 500;
const TIME_TO_IDLE = 3000;

type Props = {
    adminMode?: boolean;
};

const SendTestNotificationNotice = ({
    adminMode = false,
}: Props) => {
    const intl = useIntl();
    const [buttonState, setButtonState] = useState<'idle'|'sending'|'sent'|'error'>('idle');
    const isSending = useRef(false);
    const timeout = useRef<NodeJS.Timeout>();

    const onSendTestNotificationClick = useCallback(async () => {
        if (isSending.current) {
            return;
        }
        isSending.current = true;
        let isShowingSending = false;
        timeout.current = setTimeout(() => {
            isShowingSending = true;
            setButtonState('sending');
        }, TIME_TO_SENDING);
        const result = await sendTestNotification();
        clearTimeout(timeout.current);
        const setResult = () => {
            if (result.status === 'OK') {
                setButtonState('sent');
            } else {
                // eslint-disable-next-line no-console
                console.error(result);
                setButtonState('error');
            }
            timeout.current = setTimeout(() => {
                isSending.current = false;
                setButtonState('idle');
            }, TIME_TO_IDLE);
        };

        if (isShowingSending) {
            timeout.current = setTimeout(setResult, TIME_TO_SEND);
        } else {
            setResult();
        }
    }, []);

    useEffect(() => {
        return () => {
            clearTimeout(timeout.current);
        };
    }, []);

    const primaryButton = useMemo(() => {
        let text;
        let icon;
        let loading;
        switch (buttonState) {
        case 'idle':
            text = intl.formatMessage({id: 'user_settings.notifications.test_notification.send_button.send', defaultMessage: 'Send a test notification'});
            break;
        case 'sending':
            text = intl.formatMessage({id: 'user_settings.notifications.test_notification.send_button.sending', defaultMessage: 'Sending a test notification'});
            loading = true;
            break;
        case 'sent':
            text = intl.formatMessage({id: 'user_settings.notifications.test_notification.send_button.sent', defaultMessage: 'Test notification sent'});
            icon = 'icon-check';
            break;
        case 'error':
            text = intl.formatMessage({id: 'user_settings.notifications.test_notification.send_button.sent', defaultMessage: 'Error sending test notification'});
            icon = 'icon-alert-outline';
        }
        return {
            onClick: onSendTestNotificationClick,
            text,
            leadingIcon: icon,
            loading,
        };
    }, [buttonState, intl, onSendTestNotificationClick]);

    const secondaryButton = useMemo(() => {
        return {
            onClick: onGoToNotificationDocumentation,
            text: intl.formatMessage({id: 'user_settings.notifications.test_notification.go_to_docs', defaultMessage: 'Troubleshooting docs'}),
            trailingIcon: 'icon-open-in-new',
        };
    }, [intl]);

    if (adminMode) {
        return null;
    }

    return (
        <>
            <div className='divider-light'/>
            <div style={sectionNoticeContainerStyle}>
                <SectionNotice
                    text={intl.formatMessage({
                        id: 'user_settings.notifications.test_notification.body',
                        defaultMessage: 'Not receiving notifications? Start by sending a test notification to all your devices to check if they’re working as expected. If issues persist, explore ways to solve them with troubleshooting steps.',
                    })}
                    title={intl.formatMessage({id: 'user_settings.notifications.test_notification.title', defaultMessage: 'Troubleshooting notifications'})}
                    primaryButton={primaryButton}
                    secondaryButton={secondaryButton}
                    type='hint'
                />
            </div>
        </>
    );
};

export default SendTestNotificationNotice;
