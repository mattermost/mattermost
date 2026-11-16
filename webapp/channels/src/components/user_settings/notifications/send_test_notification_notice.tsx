// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {AlertOutlineIcon, CheckIcon, LightbulbOutlineIcon, OpenInNewIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {SectionNotice} from '@mattermost/compass-ui/components/section-notice';

import {sendTestNotification} from 'actions/notification_actions';

import {useExternalLink} from 'components/common/hooks/use_external_link';

import SectionNoticeActions from './section_notice_actions';

const sectionNoticeContainerStyle: React.CSSProperties = {marginTop: 20};

const TIME_TO_SENDING = 500;
const TIME_TO_SEND = 500;
const TIME_TO_IDLE = 3000;

type Props = {
    adminMode?: boolean;
};

type ButtonState = 'idle' | 'sending' | 'sent' | 'error';

const SendTestNotificationNotice = ({
    adminMode = false,
}: Props) => {
    const intl = useIntl();
    const [buttonState, setButtonState] = useState<ButtonState>('idle');
    const isSending = useRef(false);
    const timeout = useRef<NodeJS.Timeout>(undefined);
    const [externalLink] = useExternalLink('https://mattermost.com/pl/troubleshoot-notifications');

    const onGoToNotificationDocumentation = useCallback(() => {
        window.open(externalLink);
    }, [externalLink]);

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
                // We want to log this error into the console mainly
                // for debugging reasons. We still use the 'error' level
                // because it is an unexpected error.
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

    const sendButton = useMemo(() => {
        switch (buttonState) {
        case 'sending':
            return {
                text: intl.formatMessage({id: 'user_settings.notifications.test_notification.send_button.sending', defaultMessage: 'Sending a test notification'}),
                loading: true,
            };
        case 'sent':
            return {
                text: intl.formatMessage({id: 'user_settings.notifications.test_notification.send_button.sent', defaultMessage: 'Test notification sent'}),
                icon: <Icon glyph={<CheckIcon/>}/>,
            };
        case 'error':
            return {
                text: intl.formatMessage({id: 'user_settings.notifications.test_notification.send_button.error', defaultMessage: 'Error sending test notification'}),
                icon: <Icon glyph={<AlertOutlineIcon/>}/>,
            };
        default:
            return {
                text: intl.formatMessage({id: 'user_settings.notifications.test_notification.send_button.send', defaultMessage: 'Send a test notification'}),
            };
        }
    }, [buttonState, intl]);

    if (adminMode) {
        return null;
    }

    return (
        <>
            <div className='divider-light'/>
            <div style={sectionNoticeContainerStyle}>
                <SectionNotice
                    type='hint'
                    icon={<Icon glyph={<LightbulbOutlineIcon/>}/>}
                    title={intl.formatMessage({id: 'user_settings.notifications.test_notification.title', defaultMessage: 'Troubleshooting notifications'})}
                    description={
                        <>
                            {intl.formatMessage({
                                id: 'user_settings.notifications.test_notification.body',
                                defaultMessage: 'Not receiving notifications? Start by sending a test notification to all your devices to check if they’re working as expected. If issues persist, explore ways to solve them with troubleshooting steps.',
                            })}
                            <SectionNoticeActions>
                                <Button
                                    emphasis='primary'
                                    size='small'
                                    onClick={onSendTestNotificationClick}
                                    loading={sendButton.loading}
                                    leadingIcon={sendButton.icon}
                                >
                                    {sendButton.text}
                                </Button>
                                <Button
                                    emphasis='tertiary'
                                    size='small'
                                    onClick={onGoToNotificationDocumentation}
                                    trailingIcon={<Icon glyph={<OpenInNewIcon/>}/>}
                                >
                                    {intl.formatMessage({id: 'user_settings.notifications.test_notification.go_to_docs', defaultMessage: 'Troubleshooting docs'})}
                                </Button>
                            </SectionNoticeActions>
                        </>
                    }
                />
            </div>
        </>
    );
};

export default SendTestNotificationNotice;
