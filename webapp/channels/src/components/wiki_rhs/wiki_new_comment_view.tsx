// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {InlineAnchor} from 'types/store/pages';

import {usePageCommentSubmit} from './usePageCommentSubmit';

import './wiki_new_comment_view.scss';

type Props = {
    pageId: string;
    anchor: InlineAnchor;
};

const WikiNewCommentView = ({pageId, anchor}: Props) => {
    const {formatMessage} = useIntl();
    const {page, message, submitting, handleChange, handleKeyDown} = usePageCommentSubmit(pageId);

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
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={formatMessage({
                        id: 'wiki_rhs.new_comment.placeholder',
                        defaultMessage: 'Add your comment...',
                    })}
                    aria-label={formatMessage({id: 'wiki_rhs.new_comment.label', defaultMessage: 'New inline comment'})}
                    disabled={submitting}
                />
            </div>
        </div>
    );
};

export default WikiNewCommentView;
