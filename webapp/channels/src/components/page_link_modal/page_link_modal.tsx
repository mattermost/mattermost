// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';

import './page_link_modal.scss';

type Props = {
    pages: Post[];
    wikiId: string;
    channelId: string;
    teamName: string;
    onSelect: (pageId: string, pageTitle: string, pageWikiId: string, linkText: string) => void;
    onCancel: () => void;
    initialLinkText?: string;
};

const PageLinkModal = ({
    pages,
    wikiId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    channelId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    teamName,
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
            const title = (page.props?.title as string) || untitledText;
            return title.toLowerCase().includes(searchQuery.toLowerCase());
        }).slice(0, 10);
    }, [pages, searchQuery, untitledText]);

    const handleConfirm = useCallback((indexOverride?: number) => {
        const idx = indexOverride === undefined ? selectedIndex : indexOverride;
        const selectedPage = filteredPages[idx];
        if (selectedPage && linkText.trim()) {
            const title = (selectedPage.props?.title as string) || untitledText;
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
            ariaLabel='Link to Page'
            modalHeaderText='Link to a page'
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={onCancel}
            onExited={onCancel}
            confirmButtonText='Insert Link'
            cancelButtonText='Cancel'
            isConfirmDisabled={filteredPages.length === 0 || !linkText.trim()}
            autoCloseOnConfirmButton={true}
        >
            <div className='PageLinkModal__body'>
                <label
                    htmlFor='page-search-input'
                    className='PageLinkModal__label'
                >
                    {'Search for a page'}
                </label>
                <div className='PageLinkModal__search-wrapper'>
                    <i className='icon icon-magnify PageLinkModal__search-icon'/>
                    <input
                        id='page-search-input'
                        type='text'
                        className='form-control PageLinkModal__search-input'
                        placeholder='Type to search...'
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
                            {searchQuery ? 'No pages found' : 'No pages available'}
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
                                        {(page.props?.title as string) || untitledText}
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
                    {'Link text'}
                </label>
                <input
                    id='link-text-input'
                    type='text'
                    className='form-control PageLinkModal__link-input'
                    placeholder={(filteredPages[selectedIndex]?.props?.title as string) || 'Leave empty to use page title'}
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <small className='PageLinkModal__help-text'>
                    {'Use '}
                    <kbd className='PageLinkModal__kbd'>{'↑'}</kbd>
                    {' / '}
                    <kbd className='PageLinkModal__kbd'>{'↓'}</kbd>
                    {' to navigate, '}
                    <kbd className='PageLinkModal__kbd'>{'Enter'}</kbd>
                    {' to select'}
                </small>
            </div>
        </GenericModal>
    );
};

export default PageLinkModal;
