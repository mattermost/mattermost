// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import {getPageTitle} from 'utils/post_utils';

import './conflict_warning_modal.scss';

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
    onViewChanges,
    onCopyContent,
    onOverwrite,
    onCancel,
}: ConflictWarningModalProps) {
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});

    return (
        <Modal
            show={show}
            onHide={onCancel}
            backdrop='static'
            className='conflict-warning-modal'
            data-testid='conflict-warning-modal'
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
                    <p className='conflict-warning-primary'>
                        <i className='icon icon-information-outline'/>
                        <FormattedMessage
                            id='conflict_warning.first_write_message'
                            defaultMessage='Someone else published this page first while you were editing. Your changes have been preserved as a draft.'
                        />
                    </p>
                    <div className='conflict-warning-info'>
                        <strong>
                            <FormattedMessage
                                id='conflict_warning.page_title'
                                defaultMessage='Page: {title}'
                                values={{title: getPageTitle(currentPage, untitledText)}}
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
                    <p className='conflict-warning-options'>
                        <FormattedMessage
                            id='conflict_warning.options_message'
                            defaultMessage='You can view their changes, continue editing your draft to merge manually, or overwrite their version with yours.'
                        />
                    </p>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <div className='conflict-warning-actions-left'>
                    <button
                        className='btn btn-link'
                        onClick={onViewChanges}
                    >
                        <FormattedMessage
                            id='conflict_warning.view_changes'
                            defaultMessage='View Their Changes'
                        />
                    </button>
                    <button
                        className='btn btn-link'
                        onClick={onCopyContent}
                    >
                        <FormattedMessage
                            id='conflict_warning.copy_content'
                            defaultMessage='Copy My Content'
                        />
                    </button>
                </div>
                <div className='conflict-warning-actions-right'>
                    <button
                        className='btn btn-default'
                        onClick={onCancel}
                    >
                        <FormattedMessage
                            id='conflict_warning.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        className='btn btn-danger'
                        onClick={onOverwrite}
                    >
                        <FormattedMessage
                            id='conflict_warning.overwrite'
                            defaultMessage='Overwrite Anyway'
                        />
                    </button>
                </div>
            </Modal.Footer>
        </Modal>
    );
}
