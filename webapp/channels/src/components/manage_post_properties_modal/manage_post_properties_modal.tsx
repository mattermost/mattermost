// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import {TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

import {
    deleteChannelPostPropertyField,
    patchChannelPostPropertyField,
} from 'mattermost-redux/actions/properties';
import {getPostPropertyFieldsForChannel} from 'mattermost-redux/selectors/entities/properties';

import PropertyTypeIcon from 'components/property_value_editor/type_icon';

import type {DispatchFunc, GlobalState} from 'types/store';

import './manage_post_properties_modal.scss';

type Props = {
    channelId: string;
    onExited: () => void;
};

function FieldRow({field, onDeleteRequest}: {
    field: PropertyField;
    onDeleteRequest: (fieldId: string) => void;
}) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();

    const [draftName, setDraftName] = useState(field.name);

    const trimmed = draftName.trim();
    const isDirty = trimmed !== field.name;
    const isValid = trimmed.length > 0;
    const canSave = isDirty && isValid;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDraftName(e.target.value);
    };

    const handleSave = () => {
        if (!canSave) {
            return;
        }
        dispatch(patchChannelPostPropertyField(field.id, {name: trimmed}));
    };

    const handleDelete = () => {
        onDeleteRequest(field.id);
    };

    const saveLabel = formatMessage(
        {id: 'manage_post_properties_modal.save_aria', defaultMessage: 'Save {id}'},
        {id: field.id},
    );
    const deleteLabel = formatMessage(
        {id: 'manage_post_properties_modal.delete_aria', defaultMessage: 'Delete {id}'},
        {id: field.id},
    );

    return (
        <div
            className='manage-post-properties-modal__row'
            data-property-field-id={field.id}
        >
            <span className='manage-post-properties-modal__row-icon'>
                <PropertyTypeIcon type={field.type}/>
            </span>
            <input
                type='text'
                className='manage-post-properties-modal__name'
                value={draftName}
                aria-label={field.name}
                onChange={handleChange}
            />
            <button
                type='button'
                className='manage-post-properties-modal__save'
                aria-label={saveLabel}
                disabled={!canSave}
                onClick={handleSave}
            >
                <FormattedMessage
                    id='manage_post_properties_modal.save'
                    defaultMessage='Save'
                />
            </button>
            <button
                type='button'
                className='manage-post-properties-modal__delete'
                aria-label={deleteLabel}
                onClick={handleDelete}
            >
                <TrashCanOutlineIcon size={18}/>
            </button>
        </div>
    );
}

export default function ManagePostPropertiesModal({channelId, onExited}: Props) {
    const {formatMessage} = useIntl();
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
                            <FieldRow
                                key={field.id}
                                field={field}
                                onDeleteRequest={handleDeleteRequest}
                            />
                        ))}
                    </div>
                )}

                {pendingField && (
                    <div
                        className='manage-post-properties-modal__confirm'
                        role='alertdialog'
                        aria-label={formatMessage({id: 'manage_post_properties_modal.confirm_aria', defaultMessage: 'Confirm delete'})}
                    >
                        <p className='manage-post-properties-modal__confirm-message'>
                            <FormattedMessage
                                id='manage_post_properties_modal.confirm_delete'
                                defaultMessage='Delete property "{name}"? Existing values on posts will be removed.'
                                values={{name: pendingField.name}}
                            />
                        </p>
                        <div className='manage-post-properties-modal__confirm-actions'>
                            <button
                                type='button'
                                className='manage-post-properties-modal__confirm-cancel'
                                aria-label={formatMessage({id: 'manage_post_properties_modal.cancel_aria', defaultMessage: 'Cancel delete'})}
                                onClick={handleCancelDelete}
                            >
                                <FormattedMessage
                                    id='manage_post_properties_modal.cancel'
                                    defaultMessage='Cancel'
                                />
                            </button>
                            <button
                                type='button'
                                className='manage-post-properties-modal__confirm-delete'
                                aria-label={formatMessage({id: 'manage_post_properties_modal.confirm_aria', defaultMessage: 'Confirm delete'})}
                                onClick={handleConfirmDelete}
                            >
                                <FormattedMessage
                                    id='manage_post_properties_modal.confirm'
                                    defaultMessage='Delete'
                                />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </GenericModal>
    );
}
