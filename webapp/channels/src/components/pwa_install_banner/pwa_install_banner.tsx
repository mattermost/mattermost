// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// Modified by Techzen for PWA install prompting.

import React, { useEffect, useState } from 'react';

import './pwa_install_banner.scss';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Props = {
    onDismiss?: () => void;
}

/**
 * PWAInstallBanner - Hiển thị banner gợi ý cài đặt Techzen Chat như app
 * Chỉ hiện khi browser hỗ trợ PWA install (Chrome/Edge/Android)
 */
const PWAInstallBanner = ({ onDismiss }: Props) => {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Check if already dismissed this session
        const dismissed = sessionStorage.getItem('techzen-pwa-install-dismissed');
        if (dismissed) {
            setIsDismissed(true);
            return;
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) {
            return;
        }
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setInstallPrompt(null);
        }
    };

    const handleDismiss = () => {
        sessionStorage.setItem('techzen-pwa-install-dismissed', '1');
        setIsDismissed(true);
        onDismiss?.();
    };

    if (!installPrompt || isDismissed) {
        return null;
    }

    return (
        <div className='pwa-install-banner'>
            <div className='pwa-install-banner__icon'>
                <span>📱</span>
            </div>
            <div className='pwa-install-banner__content'>
                <strong>{'Cài Techzen Chat'}</strong>
                <span>{'Truy cập nhanh hơn từ màn hình chính'}</span>
            </div>
            <button
                className='pwa-install-banner__btn-install'
                onClick={handleInstall}
            >
                {'Cài đặt'}
            </button>
            <button
                className='pwa-install-banner__btn-dismiss'
                onClick={handleDismiss}
                aria-label='Dismiss install banner'
            >
                {'×'}
            </button>
        </div>
    );
};

export default PWAInstallBanner;
