// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';
import type {PropertyField} from '@mattermost/types/properties';

import {createChannelPostPropertyField, deleteChannelPostPropertyField, patchChannelPostPropertyField} from 'mattermost-redux/actions/properties';
import {getPostPropertyFieldsForChannel} from 'mattermost-redux/selectors/entities/properties';

import NewPropertyForm from 'components/advanced_text_editor/post_property_picker/new_property_form';
import type {NewPropertyData, NewPropertyFormHandle} from 'components/advanced_text_editor/post_property_picker/new_property_form';
import {buildPropertyFieldPatch, fieldToFormData} from 'components/advanced_text_editor/post_property_picker/property_field_form_utils';
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
    const [addingNew, setAddingNew] = useState(false);
    const [editingField, setEditingField] = useState<PropertyField | null>(null);
    const [formDisabled, setFormDisabled] = useState(false);
    const [show, setShow] = useState(true);

    const formRef = useRef<NewPropertyFormHandle>(null);

    const formActive = addingNew || editingField !== null;

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

    const handleAddNew = useCallback(() => {
        setEditingField(null);
        setAddingNew(true);
    }, []);

    const handleEditRequest = useCallback((field: PropertyField) => {
        setAddingNew(false);
        setEditingField(field);
    }, []);

    const handleCloseForm = useCallback(() => {
        setAddingNew(false);
        setEditingField(null);
    }, []);

    const handleSaveForm = useCallback(async (data: NewPropertyData) => {
        if (editingField) {
            const patch = buildPropertyFieldPatch(editingField, data);
            if (patch) {
                await dispatch(patchChannelPostPropertyField(editingField.id, patch));
            }
        } else {
            await dispatch(createChannelPostPropertyField(channelId, {
                name: data.name,
                type: data.type,
                attrs: data.options ? {options: data.options} : undefined,
            }));
        }
        handleCloseForm();
    }, [dispatch, channelId, editingField, handleCloseForm]);

    const pendingField = pendingDeleteId ? fields.find((f) => f.id === pendingDeleteId) : undefined;

    let bodyContent: React.ReactNode;
    if (formActive) {
        const inputIdPrefix = editingField ? `manage-property-${editingField.id}` : 'manage-property-new';
        bodyContent = (
            <div
                className='manage-row manage-row--editing'
                data-property-field-id={editingField?.id}
            >
                <NewPropertyForm
                    key={editingField?.id ?? 'new'}
                    ref={formRef}
                    className='manage-row__form'
                    inputIdPrefix={inputIdPrefix}
                    initialValues={editingField ? fieldToFormData(editingField) : undefined}
                    typeMenuOpensUpward={false}
                    disableSaveWhenUnchanged={Boolean(editingField)}
                    hideActions={true}
                    onSubmitDisabledChange={setFormDisabled}
                    onSave={handleSaveForm}
                    onCancel={handleCloseForm}
                />
            </div>
        );
    } else if (fields.length === 0) {
        bodyContent = (
            <div className='manage-post-properties-modal__empty'>
                <FormattedMessage
                    id='manage_post_properties_modal.empty'
                    defaultMessage='No properties yet for this channel.'
                />
            </div>
        );
    } else {
        bodyContent = (
            <div className='manage-post-properties-modal__rows'>
                {fields.map((field) => (
                    <ManageRow
                        key={field.id}
                        field={field}
                        onEditRequest={handleEditRequest}
                        onDeleteRequest={handleDeleteRequest}
                    />
                ))}
            </div>
        );
    }

    return (
        <GenericModal
            id='managePostPropertiesModal'
            className='manage-post-properties-modal'
            compassDesign={true}
            bodyPadding={false}
            show={show}
            onHide={handleHide}
            onExited={onExited}
            modalHeaderText={
                <FormattedMessage
                    id='manage_post_properties_modal.title'
                    defaultMessage='Manage properties'
                />
            }
            headerButton={!formActive && (
                <Button
                    emphasis='secondary'
                    size='sm'
                    onClick={handleAddNew}
                >
                    <FormattedMessage
                        id='manage_post_properties_modal.add_property'
                        defaultMessage='Add property'
                    />
                </Button>
            )}
            handleConfirm={formActive ? () => formRef.current?.submit() : undefined}
            handleCancel={formActive ? handleCloseForm : undefined}
            confirmButtonText={
                <FormattedMessage
                    id='manage_post_properties_modal.save'
                    defaultMessage='Save'
                />
            }
            cancelButtonText={
                <FormattedMessage
                    id='manage_post_properties_modal.cancel'
                    defaultMessage='Cancel'
                />
            }
            isConfirmDisabled={formDisabled}
            autoCloseOnConfirmButton={false}
            autoCloseOnCancelButton={false}
        >
            <div className='manage-post-properties-modal__body'>
                {bodyContent}

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
