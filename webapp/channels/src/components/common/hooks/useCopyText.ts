// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useRef, useCallback, useState} from 'react';

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

export default function useCopyText(options: CopyOptions): CopyResponse {
    const [copiedRecently, setCopiedRecently] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    let successCopyTimeout = DEFAULT_COPY_TIMEOUT;
    if (options.successCopyTimeout || options.successCopyTimeout === 0) {
        successCopyTimeout = options.successCopyTimeout;
    }

    const onClick = useCallback(() => {
        if (options.trackCallback) {
            options.trackCallback();
        }

        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const clipboard = navigator.clipboard;
        if (clipboard) {
            clipboard.writeText(options.text).
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
            textField.innerText = options.text;
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
    }, [options.text, successCopyTimeout]);

    return {
        copiedRecently,
        copyError,
        onClick,
    };
}

