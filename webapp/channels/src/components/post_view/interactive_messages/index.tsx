// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Entry point for the Interactive Messages framework.
//
// Reads a post's props, detects the payload format, runs the Translation Layer,
// and renders the result via the Block Renderer. Action dispatch delegates to
// the existing doPostAction layer, consistent with Attachments.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {doPostActionWithCookie} from 'mattermost-redux/actions/posts';

import {BlockRenderer} from 'components/block_renderer';
import {getPostInteractiveIntegrationFormat, translatePostProps} from 'components/block_renderer/translation';

import {applyIntegrationGotoLocation} from 'utils/integration_navigation';

type Props = {
    post: Post;

    /** Preview/read-only surfaces: render blocks but do not dispatch actions. */
    interactionsDisabled?: boolean;
};

const InteractiveMessages = ({post, interactionsDisabled = false}: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const [actionError, setActionError] = useState<string | null>(null);

    const postProps = post.props as Record<string, unknown> | undefined;
    const mmBlocksActionsProp = postProps?.mm_blocks_actions;
    const mmBlocksActionCookie = typeof mmBlocksActionsProp === 'string' ? mmBlocksActionsProp : undefined;
    const integrationFormat = getPostInteractiveIntegrationFormat(postProps ?? {});

    const handleAction = useCallback(async (actionId: string, selectedOption?: string, query?: Record<string, string>, attachmentCookie?: string) => {
        const actionFailedMessage = intl.formatMessage({
            id: 'post.message_attachment.action_failed',
            defaultMessage: 'Action failed to execute',
        });
        setActionError(null);
        let actionCookie = '';
        if (integrationFormat === 'attachment') {
            actionCookie = attachmentCookie ?? '';
        } else {
            actionCookie = mmBlocksActionCookie ?? '';
        }
        try {
            const result = await dispatch(doPostActionWithCookie(post.id, actionId, actionCookie, selectedOption ?? '', query, integrationFormat));
            if (result.error) {
                const message = typeof result.error.message === 'string' && result.error.message ? result.error.message : undefined;
                setActionError(message ?? actionFailedMessage);
                return;
            }
            const goToLocation =
                typeof result.data === 'object' &&
                result.data !== null &&
                'goto_location' in result.data &&
                typeof result.data.goto_location === 'string' ? result.data.goto_location : undefined;
            if (goToLocation) {
                applyIntegrationGotoLocation(goToLocation);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : undefined;
            setActionError(message ?? actionFailedMessage);
        }
    }, [dispatch, post.id, integrationFormat, mmBlocksActionCookie, intl]);

    const blocks = translatePostProps(post.props as Record<string, unknown>, intl);
    if (!blocks || blocks.length === 0) {
        return null;
    }

    return (
        <>
            <BlockRenderer
                blocks={blocks}
                postId={post.id}
                onAction={handleAction}
                imagesMetadata={post.metadata?.images}
                inlineMarkdownActions={{
                    mmBlocksActionCookie,
                    integrationFormat,
                }}
                interactionsDisabled={interactionsDisabled}
            />
            {actionError && (
                <div className='has-error'>
                    <label className='control-label'>{actionError}</label>
                </div>
            )}
        </>
    );
};

export default InteractiveMessages;
