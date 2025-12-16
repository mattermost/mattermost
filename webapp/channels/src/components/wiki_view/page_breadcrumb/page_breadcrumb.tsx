// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {Link} from 'react-router-dom';

import type {BreadcrumbPath} from '@mattermost/types/wikis';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {loadWiki, getPageBreadcrumb} from 'actions/pages';
import {getPageDraftsForWiki} from 'selectors/page_drafts';
import {arePagesLoaded, buildBreadcrumbFromRedux, getWiki} from 'selectors/pages';

import {getWikiUrl} from 'utils/url';

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
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});
    const untitledPageText = formatMessage({id: 'wiki.untitled_page_full', defaultMessage: 'Untitled page'});
    const pagesText = formatMessage({id: 'pages_panel.title', defaultMessage: 'Pages'});
    const breadcrumbNavLabel = formatMessage({id: 'page_breadcrumb.navigation_label', defaultMessage: 'Page breadcrumb navigation'});
    const currentTeam = useSelector((state: GlobalState) => getCurrentTeam(state));
    const currentPage = useSelector((state: GlobalState) => (pageId ? getPost(state, pageId) : null));
    const pagesLoaded = useSelector((state: GlobalState) => arePagesLoaded(state, wikiId));
    const allDrafts = useSelector((state: GlobalState) => getPageDraftsForWiki(state, wikiId));
    const wiki = useSelector((state: GlobalState) => getWiki(state, wikiId));

    const teamName = currentTeam?.name || 'team';

    // Build breadcrumb from Redux for published pages (when pages are loaded)
    // Memoize by serializing to avoid infinite loops from new object references
    const reduxBreadcrumbJson = useSelector((state: GlobalState) => {
        if (!isDraft && pageId && pagesLoaded) {
            const breadcrumb = buildBreadcrumbFromRedux(state, wikiId, pageId, channelId, teamName);
            return breadcrumb ? JSON.stringify(breadcrumb) : null;
        }
        return null;
    });
    const reduxBreadcrumb = reduxBreadcrumbJson ? JSON.parse(reduxBreadcrumbJson) as BreadcrumbPath : null;

    // Helper to fix breadcrumb item paths - use /wiki/ route not /channels/
    const fixBreadcrumbPath = (item: BreadcrumbPath['items'][0]): BreadcrumbPath['items'][0] => ({
        ...item,
        path: item.type === 'wiki' ? getWikiUrl(teamName, channelId, wikiId) : getWikiUrl(teamName, channelId, wikiId, item.id),
    });

    useEffect(() => {
        const fetchBreadcrumb = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Helper to check if an ID is a draft
                const isDraftId = (id: string): boolean => {
                    return allDrafts.some((draft: PostDraft) => draft.rootId === id);
                };

                // Helper to get draft by ID
                const getDraftById = (id: string): PostDraft | undefined => {
                    return allDrafts.find((draft: PostDraft) => draft.rootId === id);
                };

                // Load wiki into Redux if not already cached
                await dispatch(loadWiki(wikiId));
                const loadedWiki = wiki;
                if (isDraft) {
                    if (parentPageId) {
                        // Check if parent is also a draft
                        if (isDraftId(parentPageId)) {
                            // Parent is a draft - build breadcrumb recursively from draft data
                            const parentDraft = getDraftById(parentPageId);
                            const parentTitle = parentDraft?.props?.title || untitledText;
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
                                        path: getWikiUrl(teamName, channelId, wikiId, grandparentId),
                                        channel_id: channelId,
                                    },
                                ];
                            } else if (!grandparentId && loadedWiki) {
                                // Parent draft is at wiki root
                                items = [{
                                    id: wikiId,
                                    title: loadedWiki.title,
                                    type: 'wiki',
                                    path: getWikiUrl(teamName, channelId, wikiId),
                                    channel_id: channelId,
                                }];
                            }

                            // Add parent draft to breadcrumb
                            items.push({
                                id: parentPageId,
                                title: parentTitle,
                                type: 'page',
                                path: getWikiUrl(teamName, channelId, wikiId, parentPageId, true),
                                channel_id: channelId,
                            });

                            const fixedPath: BreadcrumbPath = {
                                items,
                                current_page: {
                                    id: 'draft',
                                    title: draftTitle || untitledPageText,
                                    type: 'page',
                                    path: getWikiUrl(teamName, channelId, wikiId),
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
                                        path: getWikiUrl(teamName, channelId, wikiId, parentPageId),
                                        channel_id: channelId,
                                    },
                                ],
                                current_page: {
                                    id: 'draft',
                                    title: draftTitle || untitledPageText,
                                    type: 'page',
                                    path: getWikiUrl(teamName, channelId, wikiId),
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
                                path: getWikiUrl(teamName, channelId, wikiId),
                                channel_id: channelId,
                            }],
                            current_page: {
                                id: 'draft',
                                title: draftTitle || untitledPageText,
                                type: 'page',
                                path: getWikiUrl(teamName, channelId, wikiId),
                                channel_id: channelId,
                            },
                        };
                        setBreadcrumbPath(simplePath);
                    }
                } else if (pageId) {
                    // Published page - build breadcrumb from Redux (no API call)
                    // Wait for pages to be loaded by WikiView before building breadcrumb
                    // This avoids race condition when navigating via direct URL
                    if (!pagesLoaded) {
                        // Pages not loaded yet - stay in loading state
                        // WikiView's loadWikiBundle will populate pages, triggering re-render
                        return;
                    }

                    // Load wiki metadata if not already in Redux
                    await dispatch(loadWiki(wikiId));

                    // Use breadcrumb from selector (recalculated when state changes)
                    if (!reduxBreadcrumb) {
                        setError('Failed to load breadcrumb');
                        setIsLoading(false);
                        return;
                    }

                    setBreadcrumbPath(reduxBreadcrumb);
                } else if (loadedWiki) {
                    // No page selected - show wiki name only
                    setBreadcrumbPath({
                        items: [],
                        current_page: {
                            id: wikiId,
                            title: loadedWiki.title,
                            type: 'wiki',
                            path: getWikiUrl(teamName, channelId, wikiId),
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
    }, [wikiId, pageId, channelId, isDraft, parentPageId, draftTitle, currentTeam?.name, currentPage?.update_at, currentPage?.page_parent_id, currentPage?.props?.page_parent_id, currentPage?.props?.wiki_id, pagesLoaded, dispatch, allDrafts, wiki, reduxBreadcrumbJson]);

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
                <span className='breadcrumb-item'>{draftTitle || pagesText}</span>
            </div>
        );
    }

    return (
        <nav
            className={`PageBreadcrumb ${className || ''}`}
            aria-label={breadcrumbNavLabel}
            data-testid='breadcrumb'
        >
            <ol className='PageBreadcrumb__list'>
                {breadcrumbPath.items.map((item) => (
                    <li
                        key={item.id}
                        className='PageBreadcrumb__item'
                    >
                        {item.type === 'wiki' ? (
                            <span
                                className='PageBreadcrumb__wiki-name'
                                data-testid='breadcrumb-wiki-name'
                            >
                                {item.title}
                            </span>
                        ) : (
                            <Link
                                to={item.path}
                                className='PageBreadcrumb__link'
                                data-testid='breadcrumb-link'
                                aria-label={formatMessage(
                                    {id: 'page_breadcrumb.navigate_to', defaultMessage: 'Navigate to {title}'},
                                    {title: item.title},
                                )}
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
                        data-testid='breadcrumb-current'
                    >
                        {breadcrumbPath.current_page.title}
                    </span>
                </li>
            </ol>
        </nav>
    );
};

export default PageBreadcrumb;
