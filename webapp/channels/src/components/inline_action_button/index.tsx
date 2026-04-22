// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {doPostActionWithInlineContext} from 'mattermost-redux/actions/posts';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import './inline_action_button.scss';

type Props = {
    actionId: string;
    params: string;
    postId: string;
    children: React.ReactNode;
};

const InlineActionButton: React.FC<Props> = ({actionId, params, postId, children}) => {
    const [executing, setExecuting] = useState(false);

    // Ref-based guard so a second click that arrives before the next render
    // commits still sees the in-flight state — setState alone cannot prevent
    // the stale-closure double-dispatch.
    const executingRef = useRef(false);
    const mountedRef = useRef(true);
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    useEffect(() => () => {
        mountedRef.current = false;
    }, []);

    const handleClick = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (executingRef.current || !postId || !actionId) {
            return;
        }

        const inlineContext: Record<string, string> = {};
        if (params) {
            const searchParams = new URLSearchParams(params);
            searchParams.forEach((value, key) => {
                inlineContext[key] = value;
            });
        }

        executingRef.current = true;
        setExecuting(true);
        try {
            // Result is intentionally discarded: the Redux thunk dispatches
            // logError on failure, matching existing PostAction click UX.
            await dispatch(doPostActionWithInlineContext(postId, actionId, inlineContext));
        } finally {
            executingRef.current = false;
            if (mountedRef.current) {
                setExecuting(false);
            }
        }
    }, [actionId, params, postId, dispatch]);

    const executingLabel = formatMessage({id: 'inline_action_button.executing', defaultMessage: 'Executing...'});

    return (
        <button
            type='button'
            className={`InlineActionButton${executing ? ' InlineActionButton--executing' : ''}`}
            onClick={handleClick}
            disabled={executing}
            aria-busy={executing}
            aria-label={executing ? executingLabel : undefined}
        >
            <LoadingWrapper
                loading={executing}
                text={executingLabel}
            >
                {children}
            </LoadingWrapper>
        </button>
    );
};

export default InlineActionButton;
