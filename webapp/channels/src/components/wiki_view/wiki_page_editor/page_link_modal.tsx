// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo} from 'react';

import {GenericModal} from '@mattermost/components';
import type {Post} from '@mattermost/types/posts';

type Props = {
    pages: Post[];
    wikiId: string;
    channelId: string;
    teamName: string;
    onSelect: (pageId: string, pageTitle: string, pageWikiId: string, linkText?: string) => void;
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
    const [searchQuery, setSearchQuery] = useState('');
    const [linkText, setLinkText] = useState(initialLinkText || '');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filteredPages = useMemo(() => {
        return pages.filter((page) => {
            const title = (page.props?.title as string) || 'Untitled';
            return title.toLowerCase().includes(searchQuery.toLowerCase());
        }).slice(0, 10);
    }, [pages, searchQuery]);

    const handleConfirm = useCallback((indexOverride?: number) => {
        const idx = indexOverride === undefined ? selectedIndex : indexOverride;
        const selectedPage = filteredPages[idx];
        if (selectedPage) {
            const title = (selectedPage.props?.title as string) || 'Untitled';
            const pageWikiId = (selectedPage as any).wiki_id || wikiId;
            onSelect(selectedPage.id, title, pageWikiId, linkText || title);
        }
    }, [filteredPages, selectedIndex, linkText, wikiId, onSelect]);

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
            isConfirmDisabled={filteredPages.length === 0}
            autoCloseOnConfirmButton={true}
        >
            <div style={{padding: '16px 0'}}>
                <label
                    htmlFor='page-search-input'
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                    }}
                >
                    {'Search for a page'}
                </label>
                <div style={{position: 'relative', marginBottom: '16px'}}>
                    <i
                        className='icon icon-magnify'
                        style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--center-channel-color-64)',
                            fontSize: '18px',
                            pointerEvents: 'none',
                        }}
                    />
                    <input
                        id='page-search-input'
                        type='text'
                        className='form-control'
                        placeholder='Type to search...'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus={true}
                        style={{
                            width: '100%',
                            paddingLeft: '40px',
                        }}
                    />
                </div>

                <div
                    style={{
                        maxHeight: '300px',
                        overflowY: 'auto',
                        marginBottom: '16px',
                        border: '1px solid var(--center-channel-color-16)',
                        borderRadius: '4px',
                    }}
                >
                    {filteredPages.length === 0 ? (
                        <div
                            style={{
                                padding: '32px',
                                textAlign: 'center',
                                color: 'var(--center-channel-color-64)',
                            }}
                        >
                            <i
                                className='icon icon-file-document-outline'
                                style={{
                                    fontSize: '48px',
                                    marginBottom: '8px',
                                    display: 'block',
                                }}
                            />
                            {searchQuery ? 'No pages found' : 'No pages available'}
                        </div>
                    ) : (
                        filteredPages.map((page, index) => (
                            <div
                                key={page.id}
                                role='option'
                                aria-selected={index === selectedIndex}
                                onClick={() => setSelectedIndex(index)}
                                onDoubleClick={() => handleConfirm(index)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    cursor: 'pointer',
                                    backgroundColor: index === selectedIndex ? 'rgba(var(--button-bg-rgb), 0.16)' : 'transparent',
                                    borderLeft: index === selectedIndex ? '4px solid var(--button-bg)' : '4px solid transparent',
                                    borderBottom: index < filteredPages.length - 1 ? '1px solid var(--center-channel-color-08)' : 'none',
                                    transition: 'all 0.1s',
                                    fontWeight: index === selectedIndex ? 600 : 400,
                                }}
                                onKeyDown={handleKeyDown}
                            >
                                <i
                                    className='icon icon-file-document-outline'
                                    style={{
                                        marginRight: '12px',
                                        color: 'var(--center-channel-color-64)',
                                        fontSize: '20px',
                                    }}
                                />
                                <span style={{flex: 1}}>
                                    {(page.props?.title as string) || 'Untitled'}
                                </span>
                                {index === selectedIndex && (
                                    <i
                                        className='icon icon-check'
                                        style={{
                                            color: 'var(--button-bg)',
                                            fontSize: '18px',
                                        }}
                                    />
                                )}
                            </div>
                        ))
                    )}
                </div>

                <label
                    htmlFor='link-text-input'
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                    }}
                >
                    {'Link text (optional)'}
                </label>
                <input
                    id='link-text-input'
                    type='text'
                    className='form-control'
                    placeholder={(filteredPages[selectedIndex]?.props?.title as string) || 'Leave empty to use page title'}
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{width: '100%'}}
                />
                <small
                    style={{
                        display: 'block',
                        marginTop: '8px',
                        color: 'var(--center-channel-color-64)',
                    }}
                >
                    {'Use '}
                    <kbd style={{padding: '2px 6px', backgroundColor: 'var(--center-channel-color-16)', borderRadius: '3px', fontSize: '12px'}}>
                        {'↑'}
                    </kbd>
                    {' / '}
                    <kbd style={{padding: '2px 6px', backgroundColor: 'var(--center-channel-color-16)', borderRadius: '3px', fontSize: '12px'}}>
                        {'↓'}
                    </kbd>
                    {' to navigate, '}
                    <kbd style={{padding: '2px 6px', backgroundColor: 'var(--center-channel-color-16)', borderRadius: '3px', fontSize: '12px'}}>
                        {'Enter'}
                    </kbd>
                    {' to select'}
                </small>
            </div>
        </GenericModal>
    );
};

export default PageLinkModal;
