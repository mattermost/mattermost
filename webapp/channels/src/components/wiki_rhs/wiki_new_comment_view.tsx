// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type TextboxClass from 'components/textbox/textbox';

import Textbox from 'components/textbox';

import type {InlineAnchor} from 'types/store/pages';

import {usePageCommentSubmit} from './usePageCommentSubmit';
import {useWikiCommentTextbox} from './useWikiCommentTextbox';

import './wiki_new_comment_view.scss';

type Props = {
    pageId: string;
    anchor: InlineAnchor;
};

const WikiNewCommentView = ({pageId, anchor}: Props) => {
    const {formatMessage} = useIntl();
    const {page, message, submitting, handleChange, handleKeyDown} = usePageCommentSubmit(pageId);
    const textboxRef = useRef<TextboxClass>(null);

    // Defer past the toolbar click that reclaims focus to the editor; DOM-id fallback
    // covers the case where the inner SuggestionBox hasn't populated the ref yet.
    useEffect(() => {
        if (!page) {
            return undefined;
        }
        const handle = setTimeout(() => {
            const focused = textboxRef.current?.focus();
            if (focused === undefined) {
                const el = document.getElementById('wiki-new-comment-textbox');
                if (el instanceof HTMLTextAreaElement) {
                    el.focus();
                }
            }
        }, 50);
        return () => clearTimeout(handle);
    }, [page]);

    const {channelId, maxPostSize, useChannelMentions} = useWikiCommentTextbox();

    if (!page) {
        return null;
    }

    return (
        <div
            className='WikiNewCommentView'
            data-testid='comment-create'
        >
            <blockquote
                id='wiki-new-comment-anchor'
                className='WikiNewCommentView__anchor'
            >
                {anchor.text || (
                    <FormattedMessage
                        id='wiki_rhs.new_comment.no_text_selected'
                        defaultMessage='No text selected'
                    />
                )}
            </blockquote>

            <div className='WikiNewCommentView__input-container'>
                <Textbox
                    ref={textboxRef}
                    id='wiki-new-comment-textbox'
                    channelId={channelId}
                    value={message}
                    onChange={handleChange}
                    onKeyPress={() => {}}
                    onKeyDown={handleKeyDown}
                    createMessage={formatMessage({
                        id: 'wiki_rhs.new_comment.placeholder',
                        defaultMessage: 'Add your comment...',
                    })}
                    characterLimit={maxPostSize}
                    useChannelMentions={useChannelMentions}
                    disabled={submitting}
                />
            </div>
        </div>
    );
};

export default WikiNewCommentView;
