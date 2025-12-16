// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';

import {getPageTitle} from 'utils/post_utils';

import './page_link_modal.scss';

type Props = {
    pages: Post[];
    wikiId: string;
    onSelect: (pageId: string, pageTitle: string, pageWikiId: string, linkText: string) => void;
    onCancel: () => void;
    initialLinkText?: string;
};

const PageLinkModal = ({
    pages,
    wikiId,
    onSelect,
    onCancel,
    initialLinkText,
}: Props) => {
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});
    const [searchQuery, setSearchQuery] = useState('');
    const [linkText, setLinkText] = useState(initialLinkText || '');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filteredPages = useMemo(() => {
        return pages.filter((page) => {
            const title = getPageTitle(page, untitledText);
            return title.toLowerCase().includes(searchQuery.toLowerCase());
        }).slice(0, 10);
    }, [pages, searchQuery, untitledText]);

    const handleConfirm = useCallback((indexOverride?: number) => {
        const idx = indexOverride === undefined ? selectedIndex : indexOverride;
        const selectedPage = filteredPages[idx];
        if (selectedPage && linkText.trim()) {
            const title = getPageTitle(selectedPage, untitledText);
            const pageWikiId = (selectedPage as any).wiki_id || wikiId;
            onSelect(selectedPage.id, title, pageWikiId, linkText.trim());
        }
    }, [filteredPages, selectedIndex, linkText, wikiId, onSelect, untitledText]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, filteredPages.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && filteredPages[selectedIndex]) {
            e.preventDefault();
            handleConfirm();
        }
    }, [filteredPages, selectedIndex, handleConfirm]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery]);

    return (
        <GenericModal
            className='PageLinkModal'
            dataTestId='page-link-modal'
            ariaLabel={formatMessage({id: 'page_link_modal.aria_label', defaultMessage: 'Link to Page'})}
            modalHeaderText={formatMessage({id: 'page_link_modal.header', defaultMessage: 'Link to a page'})}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={onCancel}
            onExited={onCancel}
            confirmButtonText={formatMessage({id: 'page_link_modal.insert_link', defaultMessage: 'Insert Link'})}
            cancelButtonText={formatMessage({id: 'page_link_modal.cancel', defaultMessage: 'Cancel'})}
            isConfirmDisabled={filteredPages.length === 0 || !linkText.trim()}
            autoCloseOnConfirmButton={true}
        >
            <div className='PageLinkModal__body'>
                <label
                    htmlFor='page-search-input'
                    className='PageLinkModal__label'
                >
                    {formatMessage({id: 'page_link_modal.search_label', defaultMessage: 'Search for a page'})}
                </label>
                <div className='PageLinkModal__search-wrapper'>
                    <i className='icon icon-magnify PageLinkModal__search-icon'/>
                    <input
                        id='page-search-input'
                        type='text'
                        className='form-control PageLinkModal__search-input'
                        placeholder={formatMessage({id: 'page_link_modal.search_placeholder', defaultMessage: 'Type to search...'})}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus={true}
                    />
                </div>

                <div className='PageLinkModal__results'>
                    {filteredPages.length === 0 ? (
                        <div className='PageLinkModal__empty-state'>
                            <i className='icon icon-file-document-outline PageLinkModal__empty-icon'/>
                            {searchQuery ?
                                formatMessage({id: 'page_link_modal.no_pages_found', defaultMessage: 'No pages found'}) :
                                formatMessage({id: 'page_link_modal.no_pages_available', defaultMessage: 'No pages available'})}
                        </div>
                    ) : (
                        filteredPages.map((page, index) => {
                            const isSelected = index === selectedIndex;
                            return (
                                <div
                                    key={page.id}
                                    role='option'
                                    aria-selected={isSelected}
                                    onClick={() => setSelectedIndex(index)}
                                    onDoubleClick={() => handleConfirm(index)}
                                    className={`PageLinkModal__page-item ${isSelected ? 'PageLinkModal__page-item--selected' : ''}`}
                                    onKeyDown={handleKeyDown}
                                >
                                    <i className='icon icon-file-document-outline PageLinkModal__page-icon'/>
                                    <span className='PageLinkModal__page-title'>
                                        {getPageTitle(page, untitledText)}
                                    </span>
                                    {isSelected && (
                                        <i className='icon icon-check PageLinkModal__selected-icon'/>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <label
                    htmlFor='link-text-input'
                    className='PageLinkModal__label'
                >
                    {formatMessage({id: 'page_link_modal.link_text_label', defaultMessage: 'Link text'})}
                </label>
                <input
                    id='link-text-input'
                    type='text'
                    className='form-control PageLinkModal__link-input'
                    placeholder={getPageTitle(filteredPages[selectedIndex], formatMessage({id: 'page_link_modal.link_text_placeholder', defaultMessage: 'Leave empty to use page title'}))}
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <small className='PageLinkModal__help-text'>
                    {formatMessage(
                        {id: 'page_link_modal.keyboard_help', defaultMessage: 'Use {up} / {down} to navigate, {enter} to select'},
                        {
                            up: <kbd className='PageLinkModal__kbd'>{'↑'}</kbd>,
                            down: <kbd className='PageLinkModal__kbd'>{'↓'}</kbd>,
                            enter: <kbd className='PageLinkModal__kbd'>{'Enter'}</kbd>,
                        },
                    )}
                </small>
            </div>
        </GenericModal>
    );
};

export default PageLinkModal;
