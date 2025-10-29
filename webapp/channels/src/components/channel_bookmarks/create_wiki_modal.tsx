// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// [THROWAWAY CODE - PAGES EXPERIMENT] Modal for creating experimental wikis

import React, {useState, useCallback} from 'react';

import {GenericModal} from '@mattermost/components';

type Props = {
    onConfirm: (wikiName: string) => void;
    onCancel: () => void;
};

const CreateWikiModal = ({
    onConfirm,
    onCancel,
}: Props) => {
    const [wikiName, setWikiName] = useState('');

    const handleConfirm = useCallback(() => {
        const trimmedName = wikiName.trim();
        if (trimmedName) {
            onConfirm(trimmedName);
        }
    }, [wikiName, onConfirm]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        }
    }, [handleConfirm]);

    return (
        <GenericModal
            className='CreateWikiModal'
            ariaLabel='Create Wiki'
            modalHeaderText='🧪 Create Experimental Wiki'
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={handleConfirm}
            handleCancel={onCancel}
            onExited={onCancel}
            confirmButtonText='Create'
            cancelButtonText='Cancel'
            isConfirmDisabled={!wikiName.trim()}
            autoCloseOnConfirmButton={true}
        >
            <div style={{padding: '16px 0'}}>
                <label
                    htmlFor='wiki-name-input'
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: 600,
                    }}
                >
                    {'Wiki Name'}
                </label>
                <input
                    id='wiki-name-input'
                    type='text'
                    className='form-control'
                    placeholder='Enter wiki name...'
                    value={wikiName}
                    onChange={(e) => setWikiName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus={true}
                    maxLength={64}
                    style={{width: '100%'}}
                />
                <small style={{
                    display: 'block',
                    marginTop: '8px',
                    color: 'var(--center-channel-color-64)',
                }}
                >
                    {'This wiki is experimental and can be easily deleted later.'}
                </small>
            </div>
        </GenericModal>
    );
};

export default CreateWikiModal;
