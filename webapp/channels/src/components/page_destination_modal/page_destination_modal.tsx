// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';
import type {Wiki} from '@mattermost/types/wikis';

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
            <div style={{padding: '16px 0'}}>
                <div style={{marginBottom: '16px'}}>
                    <strong>{pageTitle}</strong>
                </div>

                {hasChildren && childrenWarningText && (
                    <div
                        style={{
                            padding: '12px',
                            marginBottom: '16px',
                            backgroundColor: 'var(--center-channel-color-08)',
                            borderRadius: '4px',
                            border: '1px solid var(--center-channel-color-16)',
                        }}
                    >
                        <div style={{display: 'flex', alignItems: 'flex-start'}}>
                            <i
                                className='icon icon-information-outline'
                                style={{
                                    fontSize: '18px',
                                    marginRight: '8px',
                                    marginTop: '2px',
                                    color: 'var(--button-bg)',
                                }}
                            />
                            <div>
                                <strong style={{display: 'block', marginBottom: '4px'}}>
                                    {formatMessage({id: 'page_destination_modal.children_warning_title', defaultMessage: 'Child pages will be moved'})}
                                </strong>
                                <span style={{color: 'var(--center-channel-color-72)'}}>
                                    {childrenWarningText}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {renderAdditionalInputs && (
                    <div style={{marginBottom: '16px'}}>
                        {renderAdditionalInputs()}
                    </div>
                )}

                <label
                    htmlFor='target-wiki-select'
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                    }}
                >
                    {formatMessage({id: 'page_destination_modal.select_wiki_label', defaultMessage: 'Select Target Wiki'})}
                </label>
                <select
                    id='target-wiki-select'
                    className='form-control'
                    value={selectedWikiId}
                    onChange={(e) => {
                        setSelectedWikiId(e.target.value);
                        setParentPageId(undefined);
                        setSearchQuery('');
                    }}
                    autoFocus={true}
                    style={{width: '100%', marginBottom: '16px'}}
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
                            style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontWeight: 600,
                            }}
                        >
                            {formatMessage({id: 'page_destination_modal.parent_page_label', defaultMessage: 'Parent Page (Optional)'})}
                        </label>

                        <input
                            id='parent-page-search'
                            type='text'
                            className='form-control'
                            placeholder={formatMessage({id: 'page_destination_modal.parent_page_placeholder', defaultMessage: 'Search for a parent page...'})}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{width: '100%', marginBottom: '8px'}}
                        />

                        <div
                            style={{
                                maxHeight: '200px',
                                overflowY: 'auto',
                                border: '1px solid var(--center-channel-color-16)',
                                borderRadius: '4px',
                                marginBottom: '16px',
                            }}
                        >
                            <button
                                type='button'
                                onClick={() => setParentPageId(undefined)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: 'none',
                                    background: parentPageId === undefined ? 'var(--button-bg)' : 'transparent',
                                    color: parentPageId === undefined ? 'var(--button-color)' : 'inherit',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--center-channel-color-16)',
                                }}
                            >
                                {formatMessage({id: 'page_destination_modal.root_level', defaultMessage: 'Root level (no parent)'})}
                            </button>

                            {filteredPages.length === 0 && searchQuery && (
                                <div style={{padding: '12px', color: 'var(--center-channel-color-64)'}}>
                                    {formatMessage({id: 'page_destination_modal.no_pages_matching', defaultMessage: 'No pages found matching "{query}"'}, {query: searchQuery})}
                                </div>
                            )}

                            {filteredPages.length === 0 && !searchQuery && targetPages.length === 0 && (
                                <div style={{padding: '12px', color: 'var(--center-channel-color-64)'}}>
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
                                        onClick={() => setParentPageId(page.id)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: 'none',
                                            background: parentPageId === page.id ? 'var(--button-bg)' : 'transparent',
                                            color: parentPageId === page.id ? 'var(--button-color)' : 'inherit',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid var(--center-channel-color-16)',
                                        }}
                                    >
                                        {displayTitle}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                <small
                    style={{
                        display: 'block',
                        color: 'var(--center-channel-color-64)',
                    }}
                >
                    {helpText(selectedWikiId, currentWikiId)}
                </small>
            </div>
        </GenericModal>
    );
};

export default PageDestinationModal;
