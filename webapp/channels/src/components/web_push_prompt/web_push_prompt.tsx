// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// Techzen — Web Push notification permission prompt

import React, { useEffect, useState } from 'react';

import { useWebPush } from 'hooks/use_web_push';

import './web_push_prompt.scss';

const DISMISSED_KEY = 'techzen-web-push-prompt-dismissed';

/**
 * WebPushPrompt — hiện banner "Bật thông báo?" sau khi user login.
 * Chỉ hiện 1 lần nếu user chưa từng dismiss hoặc subscribe.
 */
const WebPushPrompt = () => {
    const { status, subscribe } = useWebPush();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Chỉ hiện nếu: chưa subscribed, chưa denied, chưa dismissed
        if (status === 'idle' && !localStorage.getItem(DISMISSED_KEY)) {
            // Delay 3s để tránh popup ngay khi vừa load
            const timer = setTimeout(() => setVisible(true), 3000);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [status]);

    const handleEnable = async () => {
        setVisible(false);
        await subscribe();
    };

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, '1');
        setVisible(false);
    };

    if (!visible || status === 'subscribed' || status === 'denied' || status === 'unsupported') {
        return null;
    }

    return (
        <div className='web-push-prompt'>
            <span className='web-push-prompt__icon'>🔔</span>
            <div className='web-push-prompt__content'>
                <strong>{'Bật thông báo'}</strong>
                <span>{'Nhận tin nhắn ngay cả khi đóng tab'}</span>
            </div>
            <button
                className='web-push-prompt__btn-enable'
                onClick={handleEnable}
            >
                {'Bật'}
            </button>
            <button
                className='web-push-prompt__btn-dismiss'
                onClick={handleDismiss}
                aria-label='Dismiss notification prompt'
            >
                {'×'}
            </button>
        </div>
    );
};

export default WebPushPrompt;
