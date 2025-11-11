// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import type {Post} from '@mattermost/types/posts';
import type {Wiki} from '@mattermost/types/wikis';

import PageDestinationModal from 'components/page_destination_modal';

type Props = {
    pageId: string;
    pageTitle: string;
    currentWikiId: string;
    availableWikis: Wiki[];
    fetchPagesForWiki: (wikiId: string) => Promise<Post[]>;
    hasChildren: boolean;
    onConfirm: (targetWikiId: string, parentPageId?: string, customTitle?: string) => void;
    onCancel: () => void;
};

const DuplicatePageModal = (props: Props) => {
    const [customTitle, setCustomTitle] = useState('');

    const helpText = (selectedWiki: string, currentWiki: string) => {
        if (selectedWiki === currentWiki) {
            return 'Creates a copy in the same wiki. Specify a custom title or use default "Duplicate of [original]".';
        }
        return 'Creates a copy in the target wiki.';
    };

    const childrenWarning = props.hasChildren ? 'Child pages will NOT be duplicated - only the selected page is copied.' : undefined;

    const renderTitleInput = () => (
        <>
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
                placeholder={`Default: "Duplicate of ${props.pageTitle}"`}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                maxLength={255}
                style={{width: '100%', marginBottom: '16px'}}
            />
        </>
    );

    const handleConfirm = (targetWikiId: string, parentPageId?: string) => {
        props.onConfirm(targetWikiId, parentPageId, customTitle || undefined);
    };

    return (
        <PageDestinationModal
            {...props}
            modalHeaderText='Duplicate Page'
            confirmButtonText='Duplicate'
            helpText={helpText}
            childrenWarningText={childrenWarning}
            renderAdditionalInputs={renderTitleInput}
            onConfirm={handleConfirm}
            confirmButtonTestId='confirm-button'
        />
    );
};

export default DuplicatePageModal;
