// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import Textbox from 'components/textbox';

import {usePageCommentSubmit} from './usePageCommentSubmit';
import {useWikiCommentTextbox} from './useWikiCommentTextbox';

import './wiki_reply_comment.scss';

type Props = {
    pageId: string;
};

// Bypasses AdvancedCreateComment's channel canPost check, which always renders
// read-only for wiki backing channels (type 'W') excluded from the public channel API.
const WikiReplyComment = ({pageId}: Props) => {
    const {formatMessage} = useIntl();
    const {page, message, submitting, submitError, handleChange, handleKeyDown, handleSubmit} = usePageCommentSubmit(pageId);

    const {channelId, maxPostSize, useChannelMentions} = useWikiCommentTextbox();

    if (!page) {
        return null;
    }

    const canSubmit = Boolean(message.trim()) && !submitting;

    return (
        <div
            className='WikiReplyComment'
            data-testid='comment-create'
        >
            <span
                id='wiki-reply-shortcut-hint'
                className='sr-only'
            >
                {formatMessage({id: 'wiki_rhs.reply.shortcut_hint', defaultMessage: 'Press Ctrl+Enter to send'})}
            </span>
            <label
                htmlFor='wiki-reply-textbox'
                className='sr-only'
            >
                {formatMessage({id: 'wiki_rhs.reply.aria_label', defaultMessage: 'Reply text input'})}
            </label>
            <Textbox
                id='wiki-reply-textbox'
                channelId={channelId}
                value={message}
                onChange={handleChange}
                onKeyPress={() => {}}
                onKeyDown={handleKeyDown}
                createMessage={formatMessage({
                    id: 'wiki_rhs.reply.placeholder',
                    defaultMessage: 'Reply...',
                })}
                characterLimit={maxPostSize}
                useChannelMentions={useChannelMentions}
                disabled={submitting}
            />
            {submitError && (
                <div
                    className='WikiReplyComment__error'
                    role='alert'
                >
                    {submitError}
                </div>
            )}
            <div className='WikiReplyComment__actions'>
                <button
                    type='button'
                    className='WikiReplyComment__submit btn btn-primary btn-sm'
                    data-testid='reply_submit'
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    aria-label={formatMessage({id: 'wiki_rhs.reply.submit', defaultMessage: 'Send reply'})}
                >
                    {formatMessage({id: 'wiki_rhs.reply.submit', defaultMessage: 'Send reply'})}
                </button>
            </div>
        </div>
    );
};

export default WikiReplyComment;
