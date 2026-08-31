// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {PostActionIntegrationFormat} from '@mattermost/types/integration_actions';

import {doPostActionWithCookie} from 'mattermost-redux/actions/posts';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {applyIntegrationGotoLocation} from 'utils/integration_navigation';

import './inline_action_button.scss';

// Client-side timeout for an inline-action click. The server's
// outgoing-integration timeout can be up to 30s; we surface a "took too
// long" error sooner so the user isn't staring at a spinner indefinitely.
// The dispatch promise continues in the background after timeout — the
// mountedRef guard prevents stale setState if it eventually resolves.
const INLINE_ACTION_TIMEOUT_MS = 15_000;

// Mirrors the server-side action ID regex (model.mmBlocksActionIDRegex). An
// invalid ID can never resolve to an mm_blocks_actions entry, so reject at
// render time rather than emitting a dead button.
const MMACTION_ID_REGEX = /^[A-Za-z0-9_-]+$/;

// Cap the per-click params byte length so a crafted markdown link can't
// trigger an oversized server request. Server-side ValidateActionQuery
// enforces stricter per-key/per-value caps; this is the outer envelope.
const MAX_PARAMS_LENGTH = 2048;

const MMACTION_SCHEME = 'mmaction://';

type Props = {
    href: string;
    postId: string;
    children: React.ReactNode;

    // Optional accessible name for the button. Falls back to {children}
    // text. Required when {children} is icon-only (otherwise the button
    // has no accessible name — WCAG 4.1.2).
    label?: string;

    /**
     * Encrypted mm_blocks_actions cookie from post.props. When set, clicks use
     * doPostActionWithCookie with an empty cookie (server resolves from the post).
     */
    mmBlocksActionCookie?: string;

    integrationFormat?: PostActionIntegrationFormat;
};

// parseMmactionHref extracts (actionId, query) from an mmaction:// URL,
// applying the same validation the server enforces. Returns null if the URL
// is malformed, has an unknown scheme, has an invalid action ID, or
// exceeds the params length cap. The component renders {children} as plain
// text when this returns null, so a malformed link degrades to readable text
// rather than a broken button.
function parseMmactionHref(href: string): {actionId: string; query: Record<string, string>} | null {
    // getScheme()-style check rejects opaque "mmaction:foo" forms that would
    // mis-slice the authority below.
    if (!href.startsWith(MMACTION_SCHEME)) {
        return null;
    }
    try {
        // URL.hostname lowercases the authority per WHATWG, but the server's
        // action ID regex is case-sensitive — parse out the ID from the raw
        // string before constructing URL.
        const withoutScheme = href.slice(MMACTION_SCHEME.length);
        const actionId = withoutScheme.split(/[/?#]/, 1)[0];
        if (!MMACTION_ID_REGEX.test(actionId)) {
            return null;
        }
        const mmUrl = new URL(href);
        const params = mmUrl.search ? mmUrl.search.substring(1) : '';
        if (params.length > MAX_PARAMS_LENGTH) {
            return null;
        }
        const query: Record<string, string> = {};
        if (params) {
            new URLSearchParams(params).forEach((value, key) => {
                query[key] = value;
            });
        }
        return {actionId, query};
    } catch {
        return null;
    }
}

const InlineActionButton: React.FC<Props> = ({href, postId, children, label, mmBlocksActionCookie, integrationFormat = 'mm_block'}) => {
    const parsed = useMemo(() => parseMmactionHref(href), [href]);

    const [executing, setExecuting] = useState(false);
    const [actionError, setActionError] = useState<React.ReactNode | null>(null);

    // Ref-based guard so a second click that arrives before the next render
    // commits still sees the in-flight state — setState alone cannot prevent
    // the stale-closure double-dispatch.
    const executingRef = useRef(false);
    const mountedRef = useRef(true);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    useEffect(() => () => {
        mountedRef.current = false;

        // Clear any in-flight timeout so its closure (and the captured
        // dispatch / setState) can be GC'd as soon as the component is
        // unmounted, rather than hanging until the 15s race resolves.
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const handleClick = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (executingRef.current || !postId || !parsed) {
            return;
        }

        executingRef.current = true;
        setExecuting(true);
        setActionError(null);

        // Race the dispatch against a client-side timeout. When the
        // timeout wins, surface a "took too long" error; the dispatch
        // promise keeps running in the background and is ignored
        // (mountedRef + the local timedOut flag prevent stale state).
        let timedOut = false;
        const timeoutPromise = new Promise<{error: Error}>((resolve) => {
            timeoutRef.current = setTimeout(() => {
                timedOut = true;
                resolve({error: new Error('timeout')});
            }, INLINE_ACTION_TIMEOUT_MS);
        });

        try {
            const result = await Promise.race([
                dispatch(doPostActionWithCookie(
                    postId,
                    parsed.actionId,
                    mmBlocksActionCookie ?? '',
                    '',
                    parsed.query,
                    integrationFormat ?? '',
                )) as unknown as Promise<{error?: {message?: string}; data?: {goto_location?: string}}>,
                timeoutPromise,
            ]);
            if (mountedRef.current && result?.error) {
                if (timedOut) {
                    setActionError(formatMessage({
                        id: 'inline_action_button.timeout',
                        defaultMessage: 'Action timed out. Try again.',
                    }));
                } else {
                    setActionError(
                        result.error.message || (
                            <FormattedMessage
                                id='post.message_attachment.action_failed'
                                defaultMessage='Action failed to execute'
                            />
                        ),
                    );
                }
            } else if (
                mountedRef.current &&
                result &&
                'data' in result &&
                result.data?.goto_location
            ) {
                applyIntegrationGotoLocation(result.data.goto_location);
            }
        } catch {
            if (mountedRef.current && !timedOut) {
                setActionError(
                    <FormattedMessage
                        id='post.message_attachment.action_failed'
                        defaultMessage='Action failed to execute'
                    />,
                );
            } else if (mountedRef.current && timedOut) {
                setActionError(formatMessage({
                    id: 'inline_action_button.timeout',
                    defaultMessage: 'Action timed out. Try again.',
                }));
            }
        } finally {
            // The race may have resolved via timeout while the dispatch
            // still runs in the background; clearing the handle here
            // covers the dispatch-wins-first path too.
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            executingRef.current = false;
            if (mountedRef.current) {
                setExecuting(false);
            }
        }
    }, [parsed, postId, dispatch, formatMessage, mmBlocksActionCookie, integrationFormat]);

    // Malformed href (or empty postId): render the link body as plain text
    // so users see something readable rather than a broken button.
    if (!parsed || !postId) {
        return <>{children}</>;
    }

    const executingLabel = formatMessage({id: 'inline_action_button.executing', defaultMessage: 'Executing...'});

    return (
        <>
            <button
                type='button'
                className={classNames('InlineActionButton', {'InlineActionButton--executing': executing})}
                onClick={handleClick}
                aria-disabled={executing || undefined}
                aria-busy={executing || undefined}
                aria-label={executing ? executingLabel : label}
            >
                <LoadingWrapper
                    loading={executing}
                    text={executingLabel}
                >
                    {children}
                </LoadingWrapper>
            </button>
            {actionError && (
                <div className='has-error'>
                    <span
                        role='alert'
                        className='control-label'
                    >
                        {actionError}
                    </span>
                </div>
            )}
        </>
    );
};

export default InlineActionButton;
