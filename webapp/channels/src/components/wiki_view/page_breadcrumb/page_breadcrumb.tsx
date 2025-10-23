// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import type {GlobalState} from '@mattermost/types/store';
import type {BreadcrumbPath} from '@mattermost/types/wikis';

import {Client4} from 'mattermost-redux/client';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import './page_breadcrumb.scss';

type Props = {
    wikiId: string;
    pageId: string;
    channelId: string;
    isDraft: boolean;
    parentPageId?: string;
    draftTitle?: string;
    className?: string;
};

const PageBreadcrumb = ({wikiId, pageId, channelId, isDraft, parentPageId, draftTitle, className}: Props) => {
    const [breadcrumbPath, setBreadcrumbPath] = useState<BreadcrumbPath | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const currentTeam = useSelector((state: GlobalState) => getCurrentTeam(state));
    const currentPage = useSelector((state: GlobalState) => (pageId ? getPost(state, pageId) : null));

    // Helper to fix breadcrumb item paths - use /wiki/ route not /channels/
    const fixBreadcrumbPath = (item: BreadcrumbPath['items'][0]): BreadcrumbPath['items'][0] => ({
        ...item,
        path: item.type === 'wiki' ? `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}` : `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}/${item.id}`,
    });

    useEffect(() => {
        const fetchBreadcrumb = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (isDraft) {
                    // For drafts at wiki root (no pageId), just show wiki + draft
                    // Don't show parent hierarchy since we're not on a page URL
                    const wiki = await Client4.getWiki(wikiId);
                    const simplePath: BreadcrumbPath = {
                        items: [{
                            id: wikiId,
                            title: wiki.title,
                            type: 'wiki',
                            path: `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}`,
                            channel_id: channelId,
                        }],
                        current_page: {
                            id: 'draft',
                            title: draftTitle || 'Untitled page',
                            type: 'page',
                            path: `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}`,
                            channel_id: channelId,
                        },
                    };
                    setBreadcrumbPath(simplePath);
                } else if (pageId) {
                    // Published page - get breadcrumb from server and fix paths
                    const path = await Client4.getPageBreadcrumb(wikiId, pageId);

                    const fixedPath: BreadcrumbPath = {
                        items: path.items.map(fixBreadcrumbPath),
                        current_page: path.current_page,
                    };

                    setBreadcrumbPath(fixedPath);
                } else {
                    // No page selected - show wiki name only
                    const wiki = await Client4.getWiki(wikiId);
                    setBreadcrumbPath({
                        items: [],
                        current_page: {
                            id: wikiId,
                            title: wiki.title,
                            type: 'wiki',
                            path: `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}`,
                            channel_id: channelId,
                        },
                    });
                }
            } catch (err) {
                setError('Failed to load breadcrumb');
            } finally {
                setIsLoading(false);
            }
        };

        if (wikiId) {
            fetchBreadcrumb();
        }
    }, [wikiId, pageId, channelId, isDraft, parentPageId, draftTitle, currentTeam?.name, currentPage?.update_at]);

    if (isLoading) {
        return (
            <div className={`PageBreadcrumb ${className || ''}`}>
                <div className='PageBreadcrumb__skeleton'>
                    <div className='PageBreadcrumb__skeleton-segment PageBreadcrumb__skeleton-segment--short'/>
                    <div className='PageBreadcrumb__skeleton-segment PageBreadcrumb__skeleton-segment--medium'/>
                    <div className='PageBreadcrumb__skeleton-segment PageBreadcrumb__skeleton-segment--long'/>
                </div>
            </div>
        );
    }

    if (error || !breadcrumbPath) {
        return (
            <div className={`PageBreadcrumb ${className || ''}`}>
                <span className='breadcrumb-item'>{draftTitle || 'Pages'}</span>
            </div>
        );
    }

    return (
        <nav
            className={`PageBreadcrumb ${className || ''}`}
            aria-label='Page breadcrumb navigation'
        >
            <ol className='PageBreadcrumb__list'>
                {breadcrumbPath.items.map((item) => (
                    <li
                        key={item.id}
                        className='PageBreadcrumb__item'
                    >
                        <Link
                            to={item.path}
                            className='PageBreadcrumb__link'
                            aria-label={`Navigate to ${item.title}`}
                        >
                            {item.title}
                        </Link>
                    </li>
                ))}

                <li className='PageBreadcrumb__item PageBreadcrumb__item--current'>
                    <span
                        className='PageBreadcrumb__current'
                        aria-current='page'
                    >
                        {breadcrumbPath.current_page.title}
                    </span>
                </li>
            </ol>
        </nav>
    );
};

export default PageBreadcrumb;
