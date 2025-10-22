// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';

import TipTapEditor from './tiptap_editor';

type Props = {
    title: string;
    content: string;
    onTitleChange: (title: string) => void;
    onContentChange: (content: string) => void;
    currentUserId?: string;
    channelId?: string;
    teamId?: string;
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
    showAuthor = false,
}: Props) => {
    // Local state for immediate UI feedback
    const [localTitle, setLocalTitle] = useState(title);

    // Sync local state when prop changes (e.g., switching drafts)
    useEffect(() => {
        setLocalTitle(title);
    }, [title]);

    const handleTitleChange = (newTitle: string) => {
        setLocalTitle(newTitle);
        onTitleChange(newTitle);
    };

    return (
        <div className='page-draft-editor'>
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
            <TipTapEditor
                content={content}
                onContentChange={onContentChange}
                placeholder="Type '/' to insert objects or start writing..."
                editable={true}
                currentUserId={currentUserId}
                channelId={channelId}
                teamId={teamId}
            />
        </div>
    );
};

export default WikiPageEditor;
