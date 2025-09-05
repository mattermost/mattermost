// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useRef, useCallback, useState} from 'react';
import {defineMessages} from 'react-intl';

type CopyOptions = {
    successCopyTimeout?: number;
    text: string;
    trackCallback?: () => void;
};

type CopyResponse = {
    copiedRecently: boolean;
    copyError: boolean;
    onClick: () => void;
};

const DEFAULT_COPY_TIMEOUT = 4000;

export default function useCopyText({
    text,
    successCopyTimeout: successCopyTimeoutReceived,
    trackCallback,
}: CopyOptions): CopyResponse {
    const [copiedRecently, setCopiedRecently] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    let successCopyTimeout = DEFAULT_COPY_TIMEOUT;
    if (successCopyTimeoutReceived || successCopyTimeoutReceived === 0) {
        successCopyTimeout = successCopyTimeoutReceived;
    }

    const onClick = useCallback(() => {
        trackCallback?.();

        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const clipboard = navigator.clipboard;
        if (clipboard) {
            clipboard.writeText(text).
                then(() => {
                    setCopiedRecently(true);
                    setCopyError(false);
                }).
                catch(() => {
                    setCopiedRecently(false);
                    setCopyError(true);
                });
        } else {
            const textField = document.createElement('textarea');
            textField.innerText = text;
            textField.style.position = 'fixed';
            textField.style.opacity = '0';

            document.body.appendChild(textField);
            textField.select();

            try {
                const success = document.execCommand('copy');
                setCopiedRecently(success);
                setCopyError(!success);
            } catch (err) {
                setCopiedRecently(false);
                setCopyError(true);
            }
            textField.remove();
        }

        timerRef.current = setTimeout(() => {
            setCopiedRecently(false);
            setCopyError(false);
        }, successCopyTimeout);
    }, [successCopyTimeout, text, trackCallback]);

    return {
        copiedRecently,
        copyError,
        onClick,
    };
}

export const messages = defineMessages({
    copy: {id: 'copy_text.copy', defaultMessage: 'Copy'},
    copied: {id: 'copy_text.copied', defaultMessage: 'Copied'},
});
