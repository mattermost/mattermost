// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {getUser as getUserAction} from 'mattermost-redux/actions/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {loadChannelPages} from 'actions/pages';
import {getChannelPages} from 'selectors/pages';

import ActiveEditorsIndicator from 'components/active_editors_indicator';
import InlineCommentModal from 'components/inline_comment_modal';
import ProfilePicture from 'components/profile_picture';
import UserProfile from 'components/user_profile';

import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import TipTapEditor from './tiptap_editor';

import {usePageInlineComments} from '../hooks/usePageInlineComments';
import PageStatusSelector from '../page_status_selector';

type Props = {
    title: string;
    content: string;
    onTitleChange: (title: string) => void;
    onContentChange: (content: string) => void;
    authorId?: string;
    currentUserId?: string;
    channelId?: string;
    teamId?: string;
    pageId?: string;
    wikiId?: string;
    showAuthor?: boolean;
    isExistingPage?: boolean;
    draftStatus?: string;
    onDraftStatusChange?: (status: string) => void;
};

const WikiPageEditor = ({
    title,
    content,
    onTitleChange,
    onContentChange,
    authorId,
    currentUserId,
    channelId,
    teamId,
    pageId,
    wikiId,
    showAuthor = false,
    isExistingPage = false,
    draftStatus,
    onDraftStatusChange,
}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [localTitle, setLocalTitle] = useState(title);

    const pages = useSelector((state: GlobalState) => getChannelPages(state, channelId || ''));

    // Fetch author user data for ProfilePicture component
    const authorUser = useSelector((state: GlobalState) =>
        (authorId ? getUser(state, authorId) : undefined),
    );

    // Load user data if not in store
    useEffect(() => {
        if (authorId && !authorUser) {
            dispatch(getUserAction(authorId));
        }
    }, [authorId, authorUser, dispatch]);

    // Fetch all pages in the channel for cross-wiki linking
    useEffect(() => {
        if (channelId) {
            dispatch(loadChannelPages(channelId));
        }
    }, [dispatch, channelId]);

    // Use shared inline comments hook - only for existing pages (not new drafts)
    const hookPageId = isExistingPage ? pageId : undefined;
    const {
        inlineComments,
        handleCommentClick,
        handleCreateInlineComment,
        showCommentModal,
        commentAnchor,
        handleSubmitComment,
        handleCloseModal,
        deletedAnchorIds,
        clearDeletedAnchorIds,
    } = usePageInlineComments(
        hookPageId,
        wikiId,
    );

    useEffect(() => {
        setLocalTitle(title);
    }, [title]);

    const handleTitleChange = (newTitle: string) => {
        setLocalTitle(newTitle);
        onTitleChange(newTitle);
    };

    return (
        <div
            className='page-draft-editor'
            data-testid='wiki-page-editor'
        >
            <div
                className='draft-header'
                data-testid='wiki-page-editor-header'
            >
                <input
                    type='text'
                    className='page-title-input'
                    placeholder='Untitled page...'
                    value={localTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    data-testid='wiki-page-title-input'
                />
                <div
                    className='page-meta'
                    data-testid='wiki-page-meta'
                >
                    {showAuthor && authorId && (
                        <div
                            className='WikiPageEditor__author'
                            data-testid='wiki-page-author'
                            aria-label={authorUser ? formatMessage(
                                {id: 'wiki.author.aria_label', defaultMessage: 'Author: {username}'},
                                {username: authorUser.username},
                            ) : undefined}
                        >
                            {authorUser && (
                                <ProfilePicture
                                    src={Utils.imageURLForUser(authorId, authorUser.last_picture_update)}
                                    userId={authorId}
                                    username={authorUser.username}
                                    size='xs'
                                    channelId={channelId}
                                />
                            )}
                            <span className='WikiPageEditor__authorText'>
                                {formatMessage(
                                    {id: 'wiki.author.by', defaultMessage: 'By {name}'},
                                    {
                                        name: (
                                            <UserProfile
                                                userId={authorId}
                                                channelId={channelId}
                                            />
                                        ),
                                    },
                                )}
                            </span>
                        </div>
                    )}
                    {wikiId && pageId && isExistingPage && (
                        <ActiveEditorsIndicator
                            wikiId={wikiId}
                            pageId={pageId}
                        />
                    )}
                    {!isExistingPage && (
                        <span
                            className='page-status badge'
                            data-testid='wiki-page-draft-badge'
                        >
                            {formatMessage({id: 'wiki.page_tree_node.draft_badge', defaultMessage: 'Draft'})}
                        </span>
                    )}
                    <div className='page-status-wrapper'>
                        <PageStatusSelector
                            pageId={pageId || ''}
                            isDraft={true}
                            draftStatus={draftStatus}
                            onDraftStatusChange={onDraftStatusChange}
                        />
                    </div>
                </div>
            </div>
            <div className='draft-content'>
                <TipTapEditor
                    content={content}
                    onContentChange={onContentChange}
                    placeholder="Type '/' to insert objects or start writing..."
                    editable={true}
                    currentUserId={currentUserId}
                    channelId={channelId}
                    teamId={teamId}
                    pageId={pageId}
                    wikiId={wikiId}
                    pages={pages}
                    inlineComments={inlineComments}
                    onCommentClick={handleCommentClick}
                    onCreateInlineComment={isExistingPage ? handleCreateInlineComment : undefined}
                    deletedAnchorIds={deletedAnchorIds}
                    onDeletedAnchorIdsProcessed={clearDeletedAnchorIds}
                />
            </div>
            {showCommentModal && commentAnchor && (
                <InlineCommentModal
                    selectedText={commentAnchor.text}
                    onSubmit={handleSubmitComment}
                    onExited={handleCloseModal}
                />
            )}
        </div>
    );
};

export default WikiPageEditor;
