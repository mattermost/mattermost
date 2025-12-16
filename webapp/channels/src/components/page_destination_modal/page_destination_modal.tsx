// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';
import type {Wiki} from '@mattermost/types/wikis';

import './page_destination_modal.scss';

type Props = {
    pageId: string;
    pageTitle: string;
    currentWikiId: string;
    availableWikis: Wiki[];
    modalHeaderText: string;
    confirmButtonText: string;
    helpText: (selectedWiki: string, currentWiki: string) => string;
    hasChildren?: boolean;
    childrenWarningText?: string;
    renderAdditionalInputs?: () => React.ReactNode;
    fetchPagesForWiki: (wikiId: string) => Promise<Post[]>;
    onConfirm: (targetWikiId: string, parentPageId?: string) => void;
    onCancel: () => void;
    confirmButtonTestId?: string;
};

const PageDestinationModal = ({
    pageId,
    pageTitle,
    currentWikiId,
    availableWikis,
    modalHeaderText,
    confirmButtonText,
    helpText,
    hasChildren,
    childrenWarningText,
    renderAdditionalInputs,
    fetchPagesForWiki,
    onConfirm,
    onCancel,
    confirmButtonTestId,
}: Props) => {
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});
    const [selectedWikiId, setSelectedWikiId] = useState(currentWikiId);
    const [parentPageId, setParentPageId] = useState<string | undefined>();
    const [searchQuery, setSearchQuery] = useState('');
    const [allPages, setAllPages] = useState<Post[]>([]);

    // Fetch pages when selected wiki changes
    useEffect(() => {
        if (!selectedWikiId) {
            setAllPages([]);
            return;
        }

        const fetchPages = async () => {
            try {
                const pages = await fetchPagesForWiki(selectedWikiId);
                setAllPages(pages);
            } catch (error) {
                setAllPages([]);
            }
        };

        fetchPages();
    }, [selectedWikiId, fetchPagesForWiki]);

    // Build descendant map to prevent circular references
    const descendantIds = useMemo(() => {
        const ids = new Set<string>();
        const findDescendants = (id: string) => {
            allPages.forEach((page) => {
                if (page.page_parent_id === id && page.id !== pageId) {
                    ids.add(page.id);
                    findDescendants(page.id);
                }
            });
        };
        findDescendants(pageId);
        return ids;
    }, [allPages, pageId]);

    // Filter pages for selected wiki
    // Note: allPages already contains pages for the selected wiki (filtered by backend API)
    // We just need to exclude the page being moved and its descendants
    const targetPages = useMemo(() => {
        if (!selectedWikiId || !allPages.length) {
            return [];
        }
        const filtered = allPages.filter((page) => {
            const checks = {
                notSelf: page.id !== pageId,
                notDescendant: !descendantIds.has(page.id),
                isPage: page.type === 'page',
            };
            return checks.notSelf && checks.notDescendant && checks.isPage;
        });
        return filtered;
    }, [allPages, selectedWikiId, pageId, descendantIds]);

    // Filter pages by search query
    const filteredPages = useMemo(() => {
        if (!searchQuery.trim()) {
            return targetPages;
        }
        const query = searchQuery.toLowerCase();
        return targetPages.filter((page) => {
            const title = typeof page.props?.title === 'string' ? page.props.title : '';
            const searchText = title || page.message || '';
            return searchText.toLowerCase().includes(query);
        });
    }, [targetPages, searchQuery]);

    const handleConfirm = useCallback(() => {
        if (selectedWikiId) {
            onConfirm(selectedWikiId, parentPageId);
        }
    }, [selectedWikiId, parentPageId, onConfirm]);

    return (
        <GenericModal
            className='PageDestinationModal'
            ariaLabel={modalHeaderText}
            modalHeaderText={modalHeaderText}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={onCancel}
            onExited={onCancel}
            confirmButtonText={confirmButtonText}
            cancelButtonText={formatMessage({id: 'page_destination_modal.cancel', defaultMessage: 'Cancel'})}
            isConfirmDisabled={!selectedWikiId}
            autoCloseOnConfirmButton={true}
            confirmButtonTestId={confirmButtonTestId}
        >
            <div className='PageDestinationModal__body'>
                <div className='PageDestinationModal__pageTitle'>
                    <strong>{pageTitle}</strong>
                </div>

                {hasChildren && childrenWarningText && (
                    <div className='PageDestinationModal__childrenWarning'>
                        <div className='PageDestinationModal__childrenWarningContent'>
                            <i className='icon icon-information-outline PageDestinationModal__childrenWarningIcon'/>
                            <div>
                                <strong className='PageDestinationModal__childrenWarningTitle'>
                                    {formatMessage({id: 'page_destination_modal.children_warning_title', defaultMessage: 'Child pages will be moved'})}
                                </strong>
                                <span className='PageDestinationModal__childrenWarningText'>
                                    {childrenWarningText}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {renderAdditionalInputs && (
                    <div className='PageDestinationModal__additionalInputs'>
                        {renderAdditionalInputs()}
                    </div>
                )}

                <label
                    htmlFor='target-wiki-select'
                    className='PageDestinationModal__label'
                >
                    {formatMessage({id: 'page_destination_modal.select_wiki_label', defaultMessage: 'Select Target Wiki'})}
                </label>
                <select
                    id='target-wiki-select'
                    className='form-control PageDestinationModal__select'
                    value={selectedWikiId}
                    onChange={(e) => {
                        setSelectedWikiId(e.target.value);
                        setParentPageId(undefined);
                        setSearchQuery('');
                    }}
                    autoFocus={true}
                >
                    <option value=''>{formatMessage({id: 'page_destination_modal.select_wiki_placeholder', defaultMessage: '-- Select a wiki --'})}</option>
                    {availableWikis.map((wiki) => (
                        <option
                            key={wiki.id}
                            value={wiki.id}
                        >
                            {wiki.id === currentWikiId ?
                                formatMessage({id: 'page_destination_modal.wiki_current', defaultMessage: '{title} (current)'}, {title: wiki.title}) :
                                wiki.title}
                        </option>
                    ))}
                </select>

                {selectedWikiId && (
                    <>
                        <label
                            htmlFor='parent-page-search'
                            className='PageDestinationModal__label'
                        >
                            {formatMessage({id: 'page_destination_modal.parent_page_label', defaultMessage: 'Parent Page (Optional)'})}
                        </label>

                        <input
                            id='parent-page-search'
                            type='text'
                            className='form-control PageDestinationModal__searchInput'
                            placeholder={formatMessage({id: 'page_destination_modal.parent_page_placeholder', defaultMessage: 'Search for a parent page...'})}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />

                        <div className='PageDestinationModal__pageList'>
                            <button
                                type='button'
                                className={`PageDestinationModal__pageOption ${parentPageId === undefined ? 'PageDestinationModal__pageOption--selected' : ''}`}
                                onClick={() => setParentPageId(undefined)}
                            >
                                {formatMessage({id: 'page_destination_modal.root_level', defaultMessage: 'Root level (no parent)'})}
                            </button>

                            {filteredPages.length === 0 && searchQuery && (
                                <div className='PageDestinationModal__emptyMessage'>
                                    {formatMessage({id: 'page_destination_modal.no_pages_matching', defaultMessage: 'No pages found matching "{query}"'}, {query: searchQuery})}
                                </div>
                            )}

                            {filteredPages.length === 0 && !searchQuery && targetPages.length === 0 && (
                                <div className='PageDestinationModal__emptyMessage'>
                                    {formatMessage({id: 'page_destination_modal.no_pages_available', defaultMessage: 'No pages available in this wiki'})}
                                </div>
                            )}

                            {filteredPages.map((page) => {
                                const title = typeof page.props?.title === 'string' ? page.props.title : '';
                                const displayTitle = title || page.message || untitledText;
                                return (
                                    <button
                                        key={page.id}
                                        type='button'
                                        data-page-id={page.id}
                                        className={`PageDestinationModal__pageOption ${parentPageId === page.id ? 'PageDestinationModal__pageOption--selected' : ''}`}
                                        onClick={() => setParentPageId(page.id)}
                                    >
                                        {displayTitle}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                <small className='PageDestinationModal__helpText'>
                    {helpText(selectedWikiId, currentWikiId)}
                </small>
            </div>
        </GenericModal>
    );
};

export default PageDestinationModal;
