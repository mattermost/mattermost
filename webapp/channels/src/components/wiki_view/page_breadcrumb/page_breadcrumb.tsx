// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {Link} from 'react-router-dom';

import type {BreadcrumbPath} from '@mattermost/types/wikis';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {loadWiki, getPageBreadcrumb} from 'actions/pages';
import {getPageDraftsForWiki} from 'selectors/page_drafts';
import {buildBreadcrumbFromRedux} from 'selectors/pages';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

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
    const dispatch = useDispatch();
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
                // Get drafts at the time this effect runs (not reactive to draft changes)
                const state = dispatch((_, getState) => getState()) as any;
                const allDrafts = getPageDraftsForWiki(state, wikiId);

                // Helper to check if an ID is a draft
                const isDraftId = (id: string): boolean => {
                    return allDrafts.some((draft: PostDraft) => draft.rootId === id);
                };

                // Helper to get draft by ID
                const getDraftById = (id: string): PostDraft | undefined => {
                    return allDrafts.find((draft: PostDraft) => draft.rootId === id);
                };

                // Load wiki into Redux if not already cached
                const wikiResult = await dispatch(loadWiki(wikiId));
                const loadedWiki = wikiResult.data;
                if (isDraft) {
                    if (parentPageId) {
                        // Check if parent is also a draft
                        if (isDraftId(parentPageId)) {
                            // Parent is a draft - build breadcrumb recursively from draft data
                            const parentDraft = getDraftById(parentPageId);
                            const parentTitle = parentDraft?.props?.title || 'Untitled';
                            const grandparentId = parentDraft?.props?.page_parent_id;

                            // Recursively fetch grandparent breadcrumb if it exists and is published
                            let items: BreadcrumbPath['items'] = [];
                            if (grandparentId && !isDraftId(grandparentId)) {
                                const result = await dispatch(getPageBreadcrumb(wikiId, grandparentId));
                                if (result.error || !result.data) {
                                    setError('Failed to load breadcrumb');
                                    setIsLoading(false);
                                    return;
                                }
                                const grandparentPath = result.data;
                                items = [
                                    ...grandparentPath.items.map(fixBreadcrumbPath),
                                    {
                                        id: grandparentId,
                                        title: grandparentPath.current_page.title,
                                        type: 'page',
                                        path: `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}/${grandparentId}`,
                                        channel_id: channelId,
                                    },
                                ];
                            } else if (!grandparentId && loadedWiki) {
                                // Parent draft is at wiki root
                                items = [{
                                    id: wikiId,
                                    title: loadedWiki.title,
                                    type: 'wiki',
                                    path: `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}`,
                                    channel_id: channelId,
                                }];
                            }

                            // Add parent draft to breadcrumb
                            items.push({
                                id: parentPageId,
                                title: parentTitle,
                                type: 'page',
                                path: `/${currentTeam?.name || 'team'}/drafts/${parentPageId}`,
                                channel_id: channelId,
                            });

                            const fixedPath: BreadcrumbPath = {
                                items,
                                current_page: {
                                    id: 'draft',
                                    title: draftTitle || 'Untitled page',
                                    type: 'page',
                                    path: `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}`,
                                    channel_id: channelId,
                                },
                            };
                            setBreadcrumbPath(fixedPath);
                        } else {
                            // Parent is published - fetch parent breadcrumb and add draft as current page
                            const result = await dispatch(getPageBreadcrumb(wikiId, parentPageId));
                            if (result.error || !result.data) {
                                setError('Failed to load breadcrumb');
                                setIsLoading(false);
                                return;
                            }
                            const parentPath = result.data;
                            const fixedPath: BreadcrumbPath = {
                                items: [
                                    ...parentPath.items.map(fixBreadcrumbPath),
                                    {
                                        id: parentPageId,
                                        title: parentPath.current_page.title,
                                        type: 'page',
                                        path: `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}/${parentPageId}`,
                                        channel_id: channelId,
                                    },
                                ],
                                current_page: {
                                    id: 'draft',
                                    title: draftTitle || 'Untitled page',
                                    type: 'page',
                                    path: `/${currentTeam?.name || 'team'}/wiki/${channelId}/${wikiId}`,
                                    channel_id: channelId,
                                },
                            };
                            setBreadcrumbPath(fixedPath);
                        }
                    } else if (loadedWiki) {
                        // Draft at wiki root - just show wiki + draft
                        const simplePath: BreadcrumbPath = {
                            items: [{
                                id: wikiId,
                                title: loadedWiki.title,
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
                    }
                } else if (pageId) {
                    // Published page - build breadcrumb from Redux (no API call)
                    // Load wiki if not already in Redux
                    await dispatch(loadWiki(wikiId));

                    // Get current state and build breadcrumb from Redux
                    const state = dispatch((_, getState) => getState()) as any;
                    const breadcrumb = buildBreadcrumbFromRedux(
                        state,
                        wikiId,
                        pageId,
                        channelId,
                        currentTeam?.name || 'team',
                    );

                    if (!breadcrumb) {
                        setError('Failed to load breadcrumb');
                        setIsLoading(false);
                        return;
                    }

                    setBreadcrumbPath(breadcrumb as BreadcrumbPath);
                } else if (loadedWiki) {
                    // No page selected - show wiki name only
                    setBreadcrumbPath({
                        items: [],
                        current_page: {
                            id: wikiId,
                            title: loadedWiki.title,
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
    }, [wikiId, pageId, channelId, isDraft, parentPageId, draftTitle, currentTeam?.name, currentPage?.update_at, currentPage?.page_parent_id, currentPage?.props?.page_parent_id, currentPage?.props?.wiki_id, dispatch]);

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
            data-testid='breadcrumb'
        >
            <ol className='PageBreadcrumb__list'>
                {breadcrumbPath.items.map((item) => (
                    <li
                        key={item.id}
                        className='PageBreadcrumb__item'
                    >
                        {item.type === 'wiki' ? (
                            <span className='PageBreadcrumb__wiki-name'>
                                {item.title}
                            </span>
                        ) : (
                            <Link
                                to={item.path}
                                className='PageBreadcrumb__link'
                                aria-label={`Navigate to ${item.title}`}
                            >
                                {item.title}
                            </Link>
                        )}
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
