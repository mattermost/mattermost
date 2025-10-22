// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import './drafts_section.scss';

export type PageDraft = {
    id: string;
    title: string;
    lastModified: number;
    pageParentId?: string;
};

type Props = {
    drafts: PageDraft[];
    currentDraftId?: string;
    onDraftSelect: (draftId: string) => void;
};

const DraftsSection = ({drafts, currentDraftId, onDraftSelect}: Props) => {
    const [collapsed, setCollapsed] = useState(false);

    if (drafts.length === 0) {
        return null;
    }

    const formatRelativeTime = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) {
            return 'Just now';
        } else if (minutes < 60) {
            return `${minutes}m ago`;
        } else if (hours < 24) {
            return `${hours}h ago`;
        }
        return `${days}d ago`;
    };

    return (
        <div className='DraftsSection'>
            <button
                className='DraftsSection__header'
                onClick={() => setCollapsed(!collapsed)}
                aria-expanded={!collapsed}
            >
                <i className={`icon-chevron-${collapsed ? 'right' : 'down'}`}/>
                <span className='DraftsSection__title'>{'Drafts'}</span>
                <span className='DraftsSection__count'>{drafts.length}</span>
            </button>

            {!collapsed && (
                <div className='DraftsSection__list'>
                    {drafts.map((draft) => (
                        <div
                            key={draft.id}
                            className={`DraftsSection__item ${draft.id === currentDraftId ? 'DraftsSection__item--selected' : ''}`}
                            onClick={() => onDraftSelect(draft.id)}
                        >
                            <i className='icon-file-document-edit-outline'/>
                            <span className='DraftsSection__itemTitle'>
                                {draft.title || 'Untitled'}
                            </span>
                            <span className='DraftsSection__itemTime'>
                                {formatRelativeTime(draft.lastModified)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DraftsSection;
