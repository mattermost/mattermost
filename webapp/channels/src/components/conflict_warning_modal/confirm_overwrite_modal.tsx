// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import {getPageTitle} from 'utils/post_utils';

export type ConfirmOverwriteModalProps = {
    show: boolean;
    currentPage: Post;
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmOverwriteModal({
    show,
    currentPage,
    onConfirm,
    onCancel,
}: ConfirmOverwriteModalProps) {
    const {formatMessage} = useIntl();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});

    return (
        <Modal
            show={show}
            onHide={onCancel}
            backdrop='static'
            className='confirm-overwrite-modal'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title>
                    <FormattedMessage
                        id='confirm_overwrite.title'
                        defaultMessage='Confirm Overwrite'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='confirm-overwrite-content'>
                    <p className='confirm-overwrite-warning'>
                        <i className='icon icon-alert-outline'/>
                        <FormattedMessage
                            id='confirm_overwrite.warning'
                            defaultMessage='You are about to permanently replace the changes made by another user.'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='confirm_overwrite.message'
                            defaultMessage="This action cannot be undone. The other user's changes will be lost, but will remain in the page history."
                        />
                    </p>
                    <div className='confirm-overwrite-info'>
                        <strong>
                            <FormattedMessage
                                id='confirm_overwrite.page_title'
                                defaultMessage='Page: {title}'
                                values={{title: getPageTitle(currentPage, untitledText)}}
                            />
                        </strong>
                        <br/>
                        <FormattedMessage
                            id='confirm_overwrite.last_modified'
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
                    className='btn btn-default'
                    onClick={onCancel}
                >
                    <FormattedMessage
                        id='confirm_overwrite.go_back'
                        defaultMessage='Go Back'
                    />
                </button>
                <button
                    className='btn btn-danger'
                    onClick={onConfirm}
                >
                    <FormattedMessage
                        id='confirm_overwrite.confirm'
                        defaultMessage='Yes, Overwrite'
                    />
                </button>
            </Modal.Footer>
        </Modal>
    );
}
