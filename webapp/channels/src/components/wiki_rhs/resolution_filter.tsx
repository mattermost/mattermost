// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import {isPageCommentResolved} from 'selectors/wiki_posts';

export function applyResolutionFilter(posts: Post[], filter: 'all' | 'open' | 'resolved'): Post[] {
    if (filter === 'open') {
        return posts.filter((post) => !isPageCommentResolved(post));
    }
    if (filter === 'resolved') {
        return posts.filter((post) => isPageCommentResolved(post));
    }
    return [...posts].sort((a, b) => (isPageCommentResolved(a) ? 1 : 0) - (isPageCommentResolved(b) ? 1 : 0));
}

type ResolutionFilterBarProps = {
    value: 'all' | 'open' | 'resolved';
    onChange: (value: 'all' | 'open' | 'resolved') => void;
    ariaLabel: string;
};

export function ResolutionFilterBar({value, onChange, ariaLabel}: ResolutionFilterBarProps) {
    return (
        <div
            className='WikiPageThreadViewer__filter-bar'
            role='group'
            aria-label={ariaLabel}
        >
            <button
                type='button'
                className={`WikiPageThreadViewer__filter-btn ${value === 'all' ? 'active' : ''}`}
                onClick={() => onChange('all')}
                aria-pressed={value === 'all'}
                data-testid='filter-all'
            >
                <FormattedMessage
                    id='wiki.comments.all'
                    defaultMessage='All'
                />
            </button>
            <button
                type='button'
                className={`WikiPageThreadViewer__filter-btn ${value === 'open' ? 'active' : ''}`}
                onClick={() => onChange('open')}
                aria-pressed={value === 'open'}
                data-testid='filter-open'
            >
                <FormattedMessage
                    id='wiki.comments.open'
                    defaultMessage='Open'
                />
            </button>
            <button
                type='button'
                className={`WikiPageThreadViewer__filter-btn ${value === 'resolved' ? 'active' : ''}`}
                onClick={() => onChange('resolved')}
                aria-pressed={value === 'resolved'}
                data-testid='filter-resolved'
            >
                <FormattedMessage
                    id='wiki.comments.resolved'
                    defaultMessage='Resolved'
                />
            </button>
        </div>
    );
}
