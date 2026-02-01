// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import CreateComment from 'components/threading/virtualized_thread_viewer/create_comment';

import type {GlobalState} from 'types/store';
import type {InlineAnchor} from 'types/store/pages';

import './wiki_new_comment_view.scss';

type Props = {
    pageId: string;
    anchor: InlineAnchor;
};

const WikiNewCommentView = ({pageId, anchor}: Props) => {
    const {formatMessage} = useIntl();
    const page = useSelector((state: GlobalState) => getPost(state, pageId));
    const channel = useSelector((state: GlobalState) =>
        (page?.channel_id ? getChannel(state, page.channel_id) : undefined),
    );

    if (!page || !channel) {
        return null;
    }

    return (
        <div className='WikiNewCommentView'>
            <blockquote className='WikiNewCommentView__anchor'>
                {anchor.text || (
                    <FormattedMessage
                        id='wiki_rhs.new_comment.no_text_selected'
                        defaultMessage='No text selected'
                    />
                )}
            </blockquote>

            <div className='WikiNewCommentView__input-container'>
                <CreateComment
                    threadId={pageId}
                    channel={channel}
                    isThreadView={false}
                    placeholder={formatMessage({
                        id: 'wiki_rhs.new_comment.placeholder',
                        defaultMessage: 'Add your comment...',
                    })}
                />
            </div>
        </div>
    );
};

export default WikiNewCommentView;
