// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

export type UnsavedDraftModalProps = {
    show: boolean;
    draftCreateAt?: number;
    onResumeDraft: () => void;
    onDiscardDraft: () => void;
    onCancel: () => void;
};

export default function UnsavedDraftModal({
    show,
    draftCreateAt,
    onResumeDraft,
    onDiscardDraft,
    onCancel,
}: UnsavedDraftModalProps) {
    const draftAge = draftCreateAt ? new Date(draftCreateAt).toLocaleString() : '';

    return (
        <Modal
            show={show}
            onHide={onCancel}
            backdrop='static'
            role='dialog'
            aria-labelledby='unsavedDraftModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title id='unsavedDraftModalLabel'>
                    <FormattedMessage
                        id='unsaved_draft_modal.title'
                        defaultMessage='Unsaved Draft Exists'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='unsaved-draft-modal-content'>
                    <p>
                        <FormattedMessage
                            id='unsaved_draft_modal.message'
                            defaultMessage='You have an unsaved draft for this page. What would you like to do?'
                        />
                    </p>
                    {draftAge && (
                        <div className='unsaved-draft-modal-info'>
                            <FormattedMessage
                                id='unsaved_draft_modal.created_at'
                                defaultMessage='Draft created: {time}'
                                values={{time: draftAge}}
                            />
                        </div>
                    )}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    className='btn btn-primary'
                    onClick={onResumeDraft}
                    data-testid='unsaved-draft-modal-resume-button'
                >
                    <FormattedMessage
                        id='unsaved_draft_modal.resume_draft'
                        defaultMessage='Resume Draft'
                    />
                </button>
                <button
                    className='btn btn-danger'
                    onClick={onDiscardDraft}
                    data-testid='unsaved-draft-modal-discard-button'
                >
                    <FormattedMessage
                        id='unsaved_draft_modal.discard_draft'
                        defaultMessage='Discard Draft'
                    />
                </button>
                <button
                    className='btn btn-tertiary'
                    onClick={onCancel}
                    data-testid='unsaved-draft-modal-cancel-button'
                >
                    <FormattedMessage
                        id='unsaved_draft_modal.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
            </Modal.Footer>
        </Modal>
    );
}
