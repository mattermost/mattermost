// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {GenericModal} from '@mattermost/components';
import type {Wiki} from '@mattermost/types/wikis';

type Props = {
    pageId: string;
    pageTitle: string;
    currentWikiId: string;
    availableWikis: Wiki[];
    hasChildren: boolean;
    onConfirm: (targetWikiId: string, customTitle?: string) => void;
    onCancel: () => void;
};

const DuplicatePageModal = (props: Props) => {
    const [customTitle, setCustomTitle] = useState('');
    const [selectedWikiId, setSelectedWikiId] = useState(props.currentWikiId);

    const helpText = () => {
        if (selectedWikiId === props.currentWikiId) {
            return 'Creates a copy at the same level in the same wiki. Specify a custom title or use default "Copy of [original]".';
        }
        return 'Creates a copy at the root level in the target wiki.';
    };

    const handleConfirm = () => {
        if (selectedWikiId) {
            props.onConfirm(selectedWikiId, customTitle || undefined);
        }
    };

    return (
        <GenericModal
            className='DuplicatePageModal'
            ariaLabel='Duplicate Page'
            modalHeaderText='Duplicate Page'
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={props.onCancel}
            onExited={props.onCancel}
            confirmButtonText='Duplicate'
            cancelButtonText='Cancel'
            isConfirmDisabled={!selectedWikiId}
            autoCloseOnConfirmButton={true}
            confirmButtonTestId='confirm-button'
        >
            <div style={{padding: '16px 0'}}>
                <div style={{marginBottom: '16px'}}>
                    <strong>{props.pageTitle}</strong>
                </div>

                {props.hasChildren && (
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
                                <span style={{color: 'var(--center-channel-color-72)'}}>
                                    {'Child pages will NOT be duplicated - only the selected page is copied.'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <label
                    htmlFor='custom-title-input'
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                    }}
                >
                    {'Custom Title (Optional)'}
                </label>
                <input
                    id='custom-title-input'
                    type='text'
                    className='form-control'
                    placeholder={`Default: "Copy of ${props.pageTitle}"`}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    maxLength={255}
                    style={{width: '100%', marginBottom: '16px'}}
                />

                <label
                    htmlFor='target-wiki-select'
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                    }}
                >
                    {'Select Target Wiki'}
                </label>
                <select
                    id='target-wiki-select'
                    className='form-control'
                    value={selectedWikiId}
                    onChange={(e) => setSelectedWikiId(e.target.value)}
                    autoFocus={true}
                    style={{width: '100%', marginBottom: '16px'}}
                >
                    <option value=''>{'-- Select a wiki --'}</option>
                    {props.availableWikis.map((wiki) => (
                        <option
                            key={wiki.id}
                            value={wiki.id}
                        >
                            {wiki.title}{wiki.id === props.currentWikiId ? ' (current)' : ''}
                        </option>
                    ))}
                </select>

                <small
                    style={{
                        display: 'block',
                        color: 'var(--center-channel-color-64)',
                    }}
                >
                    {helpText()}
                </small>
            </div>
        </GenericModal>
    );
};

export default DuplicatePageModal;
