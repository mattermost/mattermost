// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';

import TipTapEditor from './tiptap_editor';

import {usePageInlineComments} from '../hooks/usePageInlineComments';
import InlineCommentModal from '../inline_comment_modal';

type Props = {
    title: string;
    content: string;
    onTitleChange: (title: string) => void;
    onContentChange: (content: string) => void;
    currentUserId?: string;
    channelId?: string;
    teamId?: string;
    pageId?: string;
    wikiId?: string;
    showAuthor?: boolean;
};

const WikiPageEditor = ({
    title,
    content,
    onTitleChange,
    onContentChange,
    currentUserId,
    channelId,
    teamId,
    pageId,
    wikiId,
    showAuthor = false,
}: Props) => {
    const [localTitle, setLocalTitle] = useState(title);

    // Use shared inline comments hook
    const {
        inlineComments,
        handleCommentClick,
        handleCreateInlineComment,
        showCommentModal,
        commentAnchor,
        handleSubmitComment,
        handleCloseModal,
    } = usePageInlineComments(pageId, wikiId);

    useEffect(() => {
        setLocalTitle(title);
    }, [title]);

    const handleTitleChange = (newTitle: string) => {
        setLocalTitle(newTitle);
        onTitleChange(newTitle);
    };

    return (
        <div className='page-draft-editor'>
            <div className='draft-header'>
                <input
                    type='text'
                    className='page-title-input'
                    placeholder='Untitled page...'
                    value={localTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                />
                <div className='page-meta'>
                    {showAuthor && currentUserId && (
                        <span className='page-author'>{`By ${currentUserId}`}</span>
                    )}
                    <span className='page-status badge'>{'Draft'}</span>
                    <button className='add-attributes-btn'>{'Add Attributes'}</button>
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
                    inlineComments={inlineComments}
                    onCommentClick={handleCommentClick}
                    onCreateInlineComment={handleCreateInlineComment}
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
