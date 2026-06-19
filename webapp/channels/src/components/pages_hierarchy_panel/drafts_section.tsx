// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import type {PageDraftListItem} from 'types/store/pages';

import './drafts_section.scss';

// Time conversion constants (milliseconds)
const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

export type {PageDraftListItem} from 'types/store/pages';

type Props = {
    drafts: PageDraftListItem[];
    currentDraftId?: string;
    onDraftSelect: (draftId: string) => void;
};

const DraftsSection = ({drafts, currentDraftId, onDraftSelect}: Props) => {
    const [collapsed, setCollapsed] = useState(false);
    const {formatMessage} = useIntl();

    if (drafts.length === 0) {
        return null;
    }

    const formatRelativeTime = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / MS_PER_MINUTE);
        const hours = Math.floor(diff / MS_PER_HOUR);
        const days = Math.floor(diff / MS_PER_DAY);

        if (minutes < 1) {
            return formatMessage({id: 'drafts_section.time.just_now', defaultMessage: 'Just now'});
        } else if (minutes < 60) {
            return formatMessage({id: 'drafts_section.time.minutes_ago', defaultMessage: '{minutes}m ago'}, {minutes});
        } else if (hours < 24) {
            return formatMessage({id: 'drafts_section.time.hours_ago', defaultMessage: '{hours}h ago'}, {hours});
        }
        return formatMessage({id: 'drafts_section.time.days_ago', defaultMessage: '{days}d ago'}, {days});
    };

    return (
        <div className='DraftsSection'>
            <button
                className='DraftsSection__header'
                onClick={() => setCollapsed(!collapsed)}
                aria-expanded={!collapsed}
            >
                <i className={`icon-chevron-${collapsed ? 'right' : 'down'}`}/>
                <span className='DraftsSection__title'>{formatMessage({id: 'drafts_section.title', defaultMessage: 'Drafts'})}</span>
                <span className='DraftsSection__count'>{drafts.length}</span>
            </button>

            {!collapsed && (
                <div className='DraftsSection__list'>
                    {drafts.map((draft) => (
                        <div
                            key={draft.id}
                            className={`DraftsSection__item ${draft.id === currentDraftId ? 'DraftsSection__item--selected' : ''}`}
                            onClick={() => onDraftSelect(draft.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onDraftSelect(draft.id);
                                }
                            }}
                            role='button'
                            tabIndex={0}
                        >
                            <i className='icon-file-document-edit-outline'/>
                            <span className='DraftsSection__itemTitle'>
                                {draft.title || formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'})}
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
