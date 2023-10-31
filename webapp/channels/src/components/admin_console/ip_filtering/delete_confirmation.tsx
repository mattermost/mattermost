// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import type {AllowedIPRange} from '@mattermost/types/config';

import './delete_confirmation.scss';

type Props = {
    onExited: () => void;
    onConfirm?: (filter: AllowedIPRange) => void;
    filterToDelete?: AllowedIPRange;
}

export default function DeleteConfirmationModal({onExited, onConfirm, filterToDelete}: Props) {
    const {formatMessage} = useIntl();
    return (
        <Modal
            className={'DeleteConfirmationModal'}
            dialogClassName={'DeleteConfirmationModal__dialog'}
            show={true}
            onExited={onExited}
            onHide={onExited}
        >
            <Modal.Header closeButton={true}>
                <div className='title'>
                    {formatMessage({id: 'admin.ip_filtering.delete_confirmation_title', defaultMessage: 'Delete IP Filter'})}
                </div>
            </Modal.Header>
            <Modal.Body>
                {formatMessage({
                    id: 'admin.ip_filtering.delete_confirmation_body',
                    defaultMessage: 'Are you sure you want to delete IP filter {filter}? Users with IP addresses outside of this range won\'t be able to access the workspace when IP Filtering is enabled',
                },
                {filter: (<strong>{filterToDelete?.description}</strong>)},
                )}
            </Modal.Body>
            <Modal.Footer>
                <button
                    type='button'
                    className='btn-cancel'
                    onClick={onExited}
                >
                    {formatMessage({id: 'admin.ip_filtering.cancel', defaultMessage: 'Cancel'})}
                </button>
                <button
                    type='button'
                    className='btn-delete'
                    onClick={() => onConfirm?.(filterToDelete!)}
                >
                    {formatMessage({id: 'admin.ip_filtering.delete_filter', defaultMessage: 'Delete filter'})}
                </button>
            </Modal.Footer>
        </Modal>
    );
}
