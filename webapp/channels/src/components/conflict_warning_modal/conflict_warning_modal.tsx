// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

export type ConflictWarningModalProps = {
    show: boolean;
    currentPage: Post;
    draftContent: string;
    onViewChanges: () => void;
    onCopyContent: () => void;
    onOverwrite: () => void;
    onCancel: () => void;
};

export default function ConflictWarningModal({
    show,
    currentPage,
    draftContent,
    onViewChanges,
    onCopyContent,
    onOverwrite,
    onCancel,
}: ConflictWarningModalProps) {
    return (
        <Modal
            show={show}
            onHide={onCancel}
            backdrop='static'
            className='conflict-warning-modal'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title>
                    <FormattedMessage
                        id='conflict_warning.title'
                        defaultMessage='Page Was Modified'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='conflict-warning-content'>
                    <p>
                        <FormattedMessage
                            id='conflict_warning.message'
                            defaultMessage='Someone else modified this page while you were editing. What would you like to do?'
                        />
                    </p>
                    <div className='conflict-warning-info'>
                        <strong>
                            <FormattedMessage
                                id='conflict_warning.page_title'
                                defaultMessage='Page: {title}'
                                values={{title: currentPage.props?.title || 'Untitled'}}
                            />
                        </strong>
                        <br/>
                        <FormattedMessage
                            id='conflict_warning.last_modified'
                            defaultMessage='Last modified: {time}'
                            values={{
                                time: new Date(currentPage.update_at).toLocaleString(),
                            }}
                        />
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    className='btn btn-link'
                    onClick={onViewChanges}
                >
                    <FormattedMessage
                        id='conflict_warning.view_changes'
                        defaultMessage='View Changes'
                    />
                </button>
                <button
                    className='btn btn-secondary'
                    onClick={onCopyContent}
                >
                    <FormattedMessage
                        id='conflict_warning.copy_content'
                        defaultMessage='Copy My Content'
                    />
                </button>
                <button
                    className='btn btn-danger'
                    onClick={onOverwrite}
                >
                    <FormattedMessage
                        id='conflict_warning.overwrite'
                        defaultMessage='Overwrite Changes'
                    />
                </button>
                <button
                    className='btn btn-default'
                    onClick={onCancel}
                >
                    <FormattedMessage
                        id='conflict_warning.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
            </Modal.Footer>
        </Modal>
    );
}
