// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Entry point for the Interactive Messages framework.
//
// Reads a post's props, detects the payload format, runs the Translation Layer,
// and renders the result via the Block Renderer. Action dispatch delegates to
// the existing doPostAction layer, consistent with Attachments.

import React, {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {doPostActionWithCookie} from 'mattermost-redux/actions/posts';

import {applyIntegrationGotoLocation} from 'utils/integration_navigation';

import {BlockRenderer} from './block_renderer';
import {getPostInteractiveIntegrationFormat, translatePostProps} from './translation';

type Props = {
    post: Post;
};

const InteractiveMessages = ({post}: Props) => {
    const dispatch = useDispatch();

    const mmBlocksActionsProp = (post.props as Record<string, unknown> | undefined)?.mm_blocks_actions;
    const mmBlocksActionsCookie = typeof mmBlocksActionsProp === 'string' ? mmBlocksActionsProp : undefined;

    const handleAction = useCallback(async (actionId: string, selectedOption?: string, query?: Record<string, string>, attachmentCookie?: string) => {
        const integrationFormat = getPostInteractiveIntegrationFormat(post.props as Record<string, unknown>);
        let actionCookie = '';
        if (integrationFormat === 'attachment') {
            actionCookie = attachmentCookie ?? '';
        } else {
            actionCookie = mmBlocksActionsCookie ?? '';
        }
        const result = await dispatch(doPostActionWithCookie(post.id, actionId, actionCookie, selectedOption ?? '', query, integrationFormat));
        const goToLocation =
            typeof result.data === 'object' &&
            result.data !== null &&
            'goto_location' in result.data &&
            typeof result.data.goto_location === 'string' ? result.data.goto_location : undefined;
        if (goToLocation) {
            applyIntegrationGotoLocation(goToLocation);
        }
    }, [dispatch, post.id, post.props, mmBlocksActionsCookie]);

    const blocks = translatePostProps(post.props as Record<string, unknown>);
    if (!blocks || blocks.length === 0) {
        return null;
    }

    return (
        <BlockRenderer
            blocks={blocks}
            postId={post.id}
            onAction={handleAction}
            imagesMetadata={post.metadata?.images}
        />
    );
};

export default InteractiveMessages;
