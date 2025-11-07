// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import {isMessageAttachmentArray} from '@mattermost/types/message_attachments';

import {PostTypes} from 'mattermost-redux/constants';
import {ensureString} from 'mattermost-redux/utils/post_utils';

import {usePost} from 'components/common/hooks/usePost';
import {useUser} from 'components/common/hooks/useUser';
import InlineCommentContext from 'components/inline_comment_context';
import CommentedOnFilesMessage from 'components/post_view/commented_on_files_message';
import UserProfile from 'components/user_profile';

import {stripMarkdown} from 'utils/markdown';
import {isFromWebhook} from 'utils/post_utils';
import * as Utils from 'utils/utils';

type Props = {
    onCommentClick?: React.EventHandler<React.MouseEvent>;
    rootId: string;
    enablePostUsernameOverride?: boolean;
};

function CommentedOn({onCommentClick, rootId, enablePostUsernameOverride}: Props) {
    const rootPost = usePost(rootId);
    const rootPostUser = useUser(rootPost?.user_id ?? '');

    const isPageComment = rootPost?.type === PostTypes.PAGE_COMMENT;
    const pagePost = usePost(isPageComment && rootPost?.props?.page_id ? rootPost.props.page_id as string : '');

    const rootPostOverriddenUsername = useMemo((): string => {
        if (!rootPost) {
            return '';
        }

        const rootPostIsFromWebhook = isFromWebhook(rootPost);
        if (!rootPostIsFromWebhook) {
            return '';
        }

        const propOverrideName = ensureString(rootPost?.props.override_username);
        return (propOverrideName && enablePostUsernameOverride ? propOverrideName : '');
    }, [enablePostUsernameOverride, rootPost]);

    let message: React.ReactNode = '';
    if (!rootPost) {
        message = (
            <FormattedMessage
                id='post_body.commentedOn.loadingMessage'
                defaultMessage='Loading…'
            />
        );
    } else if (rootPost.message) {
        message = Utils.replaceHtmlEntities(rootPost.message);
    } else if (rootPost.file_ids && rootPost.file_ids.length > 0) {
        message = (
            <CommentedOnFilesMessage parentPostId={rootPost.id}/>
        );
    } else if (isMessageAttachmentArray(rootPost.props?.attachments) && rootPost.props.attachments.length > 0) {
        const attachment = rootPost.props.attachments[0];
        const webhookMessage = attachment.pretext || attachment.title || attachment.text || attachment.fallback || '';
        message = Utils.replaceHtmlEntities(webhookMessage);
    }

    const parentUserProfile = (
        <UserProfile
            userId={rootPostUser?.id ?? ''}
            overwriteName={rootPostOverriddenUsername}
        />
    );

    if (isPageComment && pagePost) {
        const pageTitle = (pagePost.props?.title as string) || 'Untitled Page';
        const isInlineComment = rootPost?.props?.comment_type === 'inline';
        const anchorText = isInlineComment && rootPost?.props?.inline_anchor ?
            (rootPost.props.inline_anchor as {text: string}).text : null;

        return (
            <div
                data-testid='post-link'
                className='post__link'
            >
                <span>
                    <FormattedMessage
                        id='threading.pageComment.context'
                        defaultMessage='Commented on the page:'
                    />
                    {' '}
                    <a
                        className='theme'
                        onClick={onCommentClick}
                    >
                        {pageTitle}
                    </a>
                </span>
                {anchorText && (
                    <div style={{marginTop: '8px'}}>
                        <InlineCommentContext anchorText={anchorText}/>
                    </div>
                )}
            </div>
        );
    }

    if (rootPost?.type === PostTypes.PAGE) {
        const pageTitle = (rootPost.props?.title as string) || 'Untitled Page';
        return (
            <div
                data-testid='post-link'
                className='post__link'
            >
                <span>
                    <FormattedMessage
                        id='threading.pageComment.context'
                        defaultMessage='Commented on the page:'
                    />
                    {' '}
                    <a
                        className='theme'
                        onClick={onCommentClick}
                    >
                        {pageTitle}
                    </a>
                </span>
            </div>
        );
    }

    return (
        <div
            data-testid='post-link'
            className='post__link'
        >
            <span>
                <FormattedMessage
                    id='post_body.commentedOn'
                    defaultMessage="Commented on {name}'s message: "
                    values={{
                        name: <a className='theme user_name'>{parentUserProfile}</a>,
                    }}
                />
                <a
                    className='theme'
                    onClick={onCommentClick}
                >
                    {typeof message === 'string' ? stripMarkdown(message) : message}
                </a>
            </span>
        </div>
    );
}

export default memo(CommentedOn);
