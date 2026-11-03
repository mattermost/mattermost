// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useState} from 'react';

import {copyToClipboard} from 'utils/utils';

export type CopyStatus = 'idle' | 'copied' | 'failed';

const FEEDBACK_MS = 2000;

export default function useClipboardCopy(): [CopyStatus, (text: string) => void] {
    const [status, setStatus] = useState<CopyStatus>('idle');

    const copy = useCallback((text: string) => {
        // Plain HTTP has no Clipboard API, so fall back to the shared execCommand copy
        const written = navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.resolve().then(() => copyToClipboard(text));
        written.
            then(() => setStatus('copied'), () => setStatus('failed')).
            then(() => setTimeout(() => setStatus('idle'), FEEDBACK_MS));
    }, []);

    return [status, copy];
}
