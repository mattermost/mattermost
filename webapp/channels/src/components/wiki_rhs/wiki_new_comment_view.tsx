// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getPageById} from 'mattermost-redux/selectors/entities/pages';

import {submitPageComment} from 'actions/views/create_page_comment';

import type {GlobalState} from 'types/store';
import type {InlineAnchor} from 'types/store/pages';

import './wiki_new_comment_view.scss';

type Props = {
    pageId: string;
    anchor: InlineAnchor;
};

const WikiNewCommentView = ({pageId, anchor}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const page = useSelector((state: GlobalState) => getPageById(state, pageId));

    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (!message.trim() || submitting || !page) {
            return;
        }
        setSubmitting(true);
        await dispatch(submitPageComment(pageId, {
            message,
            fileInfos: [],
            uploadsInProgress: [],
            channelId: page.channel_id,
            rootId: pageId,
            createAt: 0,
            updateAt: 0,
        }));
        setSubmitting(false);
        setMessage('');
    }, [dispatch, message, pageId, page, submitting]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    if (!page) {
        return null;
    }

    return (
        <div
            className='WikiNewCommentView'
            data-testid='comment-create'
        >
            <blockquote className='WikiNewCommentView__anchor'>
                {anchor.text || (
                    <FormattedMessage
                        id='wiki_rhs.new_comment.no_text_selected'
                        defaultMessage='No text selected'
                    />
                )}
            </blockquote>

            <div className='WikiNewCommentView__input-container'>
                <textarea
                    className='WikiNewCommentView__textarea'
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={formatMessage({
                        id: 'wiki_rhs.new_comment.placeholder',
                        defaultMessage: 'Add your comment...',
                    })}
                    disabled={submitting}
                />
            </div>
        </div>
    );
};

export default WikiNewCommentView;
