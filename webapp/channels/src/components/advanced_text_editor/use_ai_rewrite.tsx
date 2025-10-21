// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useState} from 'react';
import {useDispatch} from 'react-redux';

import {logError} from 'mattermost-redux/actions/errors';

import {Client4} from 'mattermost-redux/client';

import type {AIRewriteAction} from './ai_rewrite_button';

export default function useAIRewrite(
    message: string,
    onRewriteComplete: (rewrittenMessage: string) => void,
) {
    const dispatch = useDispatch();
    const [isRewriting, setIsRewriting] = useState(false);

    const handleRewrite = useCallback(async (action: AIRewriteAction) => {
        if (!message || !message.trim()) {
            return;
        }

        setIsRewriting(true);

        try {
            const response = await Client4.rewriteMessage(message, action);
            onRewriteComplete(response.rewritten_message);
        } catch (error) {
            dispatch(logError({
                message: 'Failed to rewrite message with AI',
                error,
            }));
        } finally {
            setIsRewriting(false);
        }
    }, [message, onRewriteComplete, dispatch]);

    return {
        handleRewrite,
        isRewriting,
    };
}

