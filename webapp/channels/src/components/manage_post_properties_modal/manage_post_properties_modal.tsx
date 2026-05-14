// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {deleteChannelPostPropertyField} from 'mattermost-redux/actions/properties';
import {getPostPropertyFieldsForChannel} from 'mattermost-redux/selectors/entities/properties';

import ConfirmModal from 'components/confirm_modal';

import type {DispatchFunc, GlobalState} from 'types/store';

import ManageRow from './manage_row';

import './manage_post_properties_modal.scss';

type Props = {
    channelId: string;
    onExited: () => void;
};

export default function ManagePostPropertiesModal({channelId, onExited}: Props) {
    const dispatch = useDispatch<DispatchFunc>();
    const fields = useSelector(
        (state: GlobalState) => getPostPropertyFieldsForChannel(state, channelId),
    );

    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [show, setShow] = useState(true);

    const handleDeleteRequest = useCallback((fieldId: string) => {
        setPendingDeleteId(fieldId);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        if (pendingDeleteId) {
            dispatch(deleteChannelPostPropertyField(pendingDeleteId));
            setPendingDeleteId(null);
        }
    }, [dispatch, pendingDeleteId]);

    const handleCancelDelete = useCallback(() => {
        setPendingDeleteId(null);
    }, []);

    const handleHide = useCallback(() => {
        setShow(false);
    }, []);

    const pendingField = pendingDeleteId ? fields.find((f) => f.id === pendingDeleteId) : undefined;

    return (
        <GenericModal
            id='managePostPropertiesModal'
            className='manage-post-properties-modal'
            compassDesign={true}
            show={show}
            onHide={handleHide}
            onExited={onExited}
            modalHeaderText={
                <FormattedMessage
                    id='manage_post_properties_modal.title'
                    defaultMessage='Manage properties'
                />
            }
        >
            <div className='manage-post-properties-modal__body'>
                {fields.length === 0 ? (
                    <div className='manage-post-properties-modal__empty'>
                        <FormattedMessage
                            id='manage_post_properties_modal.empty'
                            defaultMessage='No properties yet for this channel.'
                        />
                    </div>
                ) : (
                    <div className='manage-post-properties-modal__rows'>
                        {fields.map((field) => (
                            <ManageRow
                                key={field.id}
                                field={field}
                                onDeleteRequest={handleDeleteRequest}
                            />
                        ))}
                    </div>
                )}

                <ConfirmModal
                    show={pendingDeleteId !== null}
                    title={
                        <FormattedMessage
                            id='manage_post_properties_modal.confirm_title'
                            defaultMessage='Delete property'
                        />
                    }
                    message={
                        <FormattedMessage
                            id='manage_post_properties_modal.confirm_delete'
                            defaultMessage='Delete property "{name}"? Existing values on posts will be removed.'
                            values={{name: pendingField?.name ?? ''}}
                        />
                    }
                    confirmButtonClass='btn btn-danger'
                    confirmButtonText={
                        <FormattedMessage
                            id='manage_post_properties_modal.confirm'
                            defaultMessage='Delete'
                        />
                    }
                    cancelButtonText={
                        <FormattedMessage
                            id='manage_post_properties_modal.cancel'
                            defaultMessage='Cancel'
                        />
                    }
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                    isStacked={true}
                />
            </div>
        </GenericModal>
    );
}
