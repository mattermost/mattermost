// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {Link} from 'react-router-dom';

import type {BreadcrumbPath} from '@mattermost/types/wikis';

import {getPageById} from 'mattermost-redux/selectors/entities/pages';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {fetchWiki, getPageBreadcrumb} from 'actions/pages';
import {getPageDraftsForWiki} from 'selectors/page_drafts';
import {arePagesLoaded, makeBreadcrumbSelector, getWiki} from 'selectors/pages';

import {getTeamNameFromPath, getWikiUrl} from 'utils/url';

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
    const currentPage = useSelector((state: GlobalState) => (pageId ? getPageById(state, pageId) : null));
    const pagesLoaded = useSelector((state: GlobalState) => arePagesLoaded(state, wikiId));
    const allDrafts = useSelector((state: GlobalState) => getPageDraftsForWiki(state, wikiId));
    const wiki = useSelector((state: GlobalState) => getWiki(state, wikiId));

    const teamName = getTeamNameFromPath(window.location.pathname) || currentTeam?.name || 'team';

    // Create memoized selector instance for this component
    const breadcrumbSelector = useMemo(() => makeBreadcrumbSelector(), []);

    // Build breadcrumb from Redux for published pages (when pages are loaded)
    const reduxBreadcrumb = useSelector((state: GlobalState) => {
        if (!isDraft && pageId && pagesLoaded) {
            return breadcrumbSelector(state, wikiId, pageId, teamName);
        }
        return null;
    });

    // Single helper that builds all wiki paths.
    const wikiPath = useCallback((pathPageId?: string, pathIsDraft?: boolean) =>
        getWikiUrl(teamName, wikiId, pathPageId, pathIsDraft), [teamName, wikiId]);

    // Rewrites any path from the API/selector to use the /wiki/ route.
    const fixBreadcrumbPath = useCallback((item: BreadcrumbPath['items'][0]): BreadcrumbPath['items'][0] => ({
        ...item,
        path: item.type === 'wiki' ? wikiPath() : wikiPath(item.id),
    }), [wikiPath]);

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
                await dispatch(fetchWiki(wikiId));
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
                                        path: wikiPath(grandparentId),
                                    },
                                ];
                            } else if (!grandparentId && loadedWiki) {
                                // Parent draft is at wiki root
                                items = [{
                                    id: wikiId,
                                    title: loadedWiki.title,
                                    type: 'wiki',
                                    path: wikiPath(),
                                }];
                            }

                            // Add parent draft to breadcrumb
                            items.push({
                                id: parentPageId,
                                title: parentTitle,
                                type: 'page',
                                path: wikiPath(parentPageId, true),
                            });

                            const fixedPath: BreadcrumbPath = {
                                items,
                                current_page: {
                                    id: 'draft',
                                    title: draftTitle || untitledPageText,
                                    type: 'page',
                                    path: wikiPath(),
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
                                        path: wikiPath(parentPageId),
                                    },
                                ],
                                current_page: {
                                    id: 'draft',
                                    title: draftTitle || untitledPageText,
                                    type: 'page',
                                    path: wikiPath(),
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
                                path: wikiPath(),
                            }],
                            current_page: {
                                id: 'draft',
                                title: draftTitle || untitledPageText,
                                type: 'page',
                                path: wikiPath(),
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
                        // WikiView's fetchWikiBundle will populate pages, triggering re-render
                        return;
                    }

                    // Load wiki metadata if not already in Redux
                    await dispatch(fetchWiki(wikiId));

                    // Use breadcrumb from selector (recalculated when state changes)
                    if (!reduxBreadcrumb) {
                        setError('Failed to load breadcrumb');
                        setIsLoading(false);
                        return;
                    }

                    setBreadcrumbPath({
                        ...reduxBreadcrumb,
                        items: reduxBreadcrumb.items.map(fixBreadcrumbPath),
                    });
                } else if (loadedWiki) {
                    // No page selected - show wiki name only
                    setBreadcrumbPath({
                        items: [],
                        current_page: {
                            id: wikiId,
                            title: loadedWiki.title,
                            type: 'wiki',
                            path: wikiPath(),
                        },
                    });
                }
            } catch {
                setError('Failed to load breadcrumb');
            } finally {
                setIsLoading(false);
            }
        };

        if (wikiId) {
            fetchBreadcrumb();
        }
    }, [wikiId, pageId, channelId, isDraft, parentPageId, draftTitle, teamName, currentPage?.parent_id, pagesLoaded, dispatch, allDrafts, wiki, reduxBreadcrumb, untitledText, untitledPageText, fixBreadcrumbPath]);

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
