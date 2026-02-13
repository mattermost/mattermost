// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';

import {getPageTitle} from 'utils/post_utils';
import {isUrlSafe, isValidUrl} from 'utils/url';

import './page_link_modal.scss';

type LinkMode = 'page' | 'url';

type Props = {
    pages: Post[];
    wikiId: string;
    onSelect: (pageId: string, pageTitle: string, pageWikiId: string, linkText: string) => void;
    onSelectUrl?: (url: string, linkText: string) => void;
    onCancel?: () => void;
    onExited: () => void;
    initialLinkText?: string;
};

const noop = () => {};

const PageLinkModal = ({
    pages,
    wikiId,
    onSelect,
    onSelectUrl,
    onCancel,
    onExited,
    initialLinkText,
}: Props) => {
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});

    const [mode, setMode] = useState<LinkMode>('page');
    const [searchQuery, setSearchQuery] = useState('');
    const [linkText, setLinkText] = useState(initialLinkText || '');
    const [urlInput, setUrlInput] = useState('');
    const [urlError, setUrlError] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isConfirming, setIsConfirming] = useState(false);
    const linkTextInputRef = useRef<HTMLInputElement>(null);
    const urlInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLinkText(initialLinkText || '');
        setSearchQuery('');
        setSelectedIndex(0);
        setIsConfirming(false);
        setUrlInput('');
        setUrlError('');
        setMode('page');
    }, [initialLinkText]);

    const filteredPages = useMemo(() => {
        return pages.filter((page) => {
            const title = getPageTitle(page, untitledText);
            return title.toLowerCase().includes(searchQuery.toLowerCase());
        }).slice(0, 10);
    }, [pages, searchQuery, untitledText]);

    const validateUrl = useCallback((url: string): boolean => {
        const trimmed = url.trim();
        if (!trimmed) {
            setUrlError(formatMessage({id: 'page_link_modal.url_required', defaultMessage: 'Please enter a URL'}));
            return false;
        }
        if (!isValidUrl(trimmed)) {
            setUrlError(formatMessage({id: 'page_link_modal.url_invalid', defaultMessage: 'Please enter a valid URL (e.g., https://example.com)'}));
            return false;
        }
        if (!isUrlSafe(trimmed)) {
            setUrlError(formatMessage({id: 'page_link_modal.url_unsafe', defaultMessage: 'Invalid URL scheme'}));
            return false;
        }
        setUrlError('');
        return true;
    }, [formatMessage]);

    const handleConfirm = useCallback((indexOverride?: number) => {
        if (mode === 'url') {
            if (!validateUrl(urlInput)) {
                return;
            }
            if (onSelectUrl) {
                setIsConfirming(true);
                const trimmedUrl = urlInput.trim();
                const finalLinkText = linkText.trim() || trimmedUrl;
                onSelectUrl(trimmedUrl, finalLinkText);
            }
            return;
        }

        const idx = indexOverride === undefined ? selectedIndex : indexOverride;
        const selectedPage = filteredPages[idx];
        if (selectedPage) {
            setIsConfirming(true);
            const title = getPageTitle(selectedPage, untitledText);
            const pageWikiId = (selectedPage as any).wiki_id || wikiId;
            const finalLinkText = linkText.trim() || title;
            onSelect(selectedPage.id, title, pageWikiId, finalLinkText);
        }
    }, [mode, urlInput, validateUrl, onSelectUrl, linkText, filteredPages, selectedIndex, wikiId, onSelect, untitledText]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (mode === 'url') {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
            return;
        }

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
    }, [mode, filteredPages, selectedIndex, handleConfirm]);

    const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setUrlInput(e.target.value);
        if (urlError) {
            setUrlError('');
        }
    }, [urlError]);

    const handleModeChange = useCallback((newMode: LinkMode) => {
        setMode(newMode);
        if (newMode === 'url') {
            setTimeout(() => urlInputRef.current?.focus(), 0);
        }
    }, []);

    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery]);

    const handlePageSelect = useCallback((index: number) => {
        setSelectedIndex(index);
        linkTextInputRef.current?.focus();
    }, []);

    const isConfirmDisabled = useMemo(() => {
        if (isConfirming) {
            return true;
        }
        if (mode === 'url') {
            return !urlInput.trim() || !onSelectUrl;
        }
        return filteredPages.length === 0;
    }, [isConfirming, mode, urlInput, onSelectUrl, filteredPages.length]);

    const renderPageMode = () => (
        <>
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
                    autoFocus={mode === 'page'}
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
                                onClick={() => handlePageSelect(index)}
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
        </>
    );

    const renderUrlMode = () => (
        <>
            <label
                htmlFor='url-input'
                className='PageLinkModal__label'
            >
                {formatMessage({id: 'page_link_modal.url_label', defaultMessage: 'URL'})}
            </label>
            <input
                ref={urlInputRef}
                id='url-input'
                type='url'
                className={`form-control PageLinkModal__url-input ${urlError ? 'is-invalid' : ''}`}
                placeholder={formatMessage({id: 'page_link_modal.url_placeholder', defaultMessage: 'https://example.com'})}
                value={urlInput}
                onChange={handleUrlChange}
                onKeyDown={handleKeyDown}
                autoFocus={mode === 'url'}
                data-testid='url-input'
            />
            {urlError && (
                <div
                    className='PageLinkModal__error-text'
                    data-testid='url-error'
                >
                    {urlError}
                </div>
            )}
        </>
    );

    const linkTextPlaceholder = mode === 'url' ?
        formatMessage({id: 'page_link_modal.link_text_url_placeholder', defaultMessage: 'Leave empty to use URL'}) :
        getPageTitle(filteredPages[selectedIndex], formatMessage({id: 'page_link_modal.link_text_placeholder', defaultMessage: 'Leave empty to use page title'}));

    return (
        <GenericModal
            className='PageLinkModal'
            dataTestId='page-link-modal'
            ariaLabel={formatMessage({id: 'page_link_modal.aria_label', defaultMessage: 'Insert Link'})}
            modalHeaderText={formatMessage({id: 'page_link_modal.header_generic', defaultMessage: 'Insert link'})}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={onCancel ?? noop}
            onExited={onExited}
            confirmButtonText={formatMessage({id: 'page_link_modal.insert_link', defaultMessage: 'Insert Link'})}
            cancelButtonText={formatMessage({id: 'page_link_modal.cancel', defaultMessage: 'Cancel'})}
            isConfirmDisabled={isConfirmDisabled}
            autoCloseOnConfirmButton={true}
        >
            <div className='PageLinkModal__body'>
                <div
                    className='PageLinkModal__tabs'
                    role='tablist'
                >
                    <button
                        type='button'
                        role='tab'
                        aria-selected={mode === 'page'}
                        className={`PageLinkModal__tab ${mode === 'page' ? 'PageLinkModal__tab--active' : ''}`}
                        onClick={() => handleModeChange('page')}
                        data-testid='tab-page'
                    >
                        <i className='icon icon-file-document-outline'/>
                        {formatMessage({id: 'page_link_modal.tab_page', defaultMessage: 'Wiki page'})}
                    </button>
                    <button
                        type='button'
                        role='tab'
                        aria-selected={mode === 'url'}
                        className={`PageLinkModal__tab ${mode === 'url' ? 'PageLinkModal__tab--active' : ''}`}
                        onClick={() => handleModeChange('url')}
                        data-testid='tab-url'
                    >
                        <i className='icon icon-link-variant'/>
                        {formatMessage({id: 'page_link_modal.tab_url', defaultMessage: 'Web URL'})}
                    </button>
                </div>

                <div className='PageLinkModal__content'>
                    {mode === 'page' ? renderPageMode() : renderUrlMode()}
                </div>

                <label
                    htmlFor='link-text-input'
                    className='PageLinkModal__label'
                >
                    {formatMessage({id: 'page_link_modal.link_text_label', defaultMessage: 'Link text'})}
                </label>
                <input
                    ref={linkTextInputRef}
                    id='link-text-input'
                    type='text'
                    className='form-control PageLinkModal__link-input'
                    placeholder={linkTextPlaceholder}
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <small className='PageLinkModal__help-text'>
                    {mode === 'page' ? formatMessage(
                        {id: 'page_link_modal.keyboard_help', defaultMessage: 'Use {up} / {down} to navigate, {enter} to select'},
                        {
                            up: <kbd className='PageLinkModal__kbd'>{'↑'}</kbd>,
                            down: <kbd className='PageLinkModal__kbd'>{'↓'}</kbd>,
                            enter: <kbd className='PageLinkModal__kbd'>{'Enter'}</kbd>,
                        },
                    ) : formatMessage({id: 'page_link_modal.url_help', defaultMessage: 'Enter a full URL (e.g., https://example.com)'})}
                </small>
            </div>
        </GenericModal>
    );
};

export default PageLinkModal;
