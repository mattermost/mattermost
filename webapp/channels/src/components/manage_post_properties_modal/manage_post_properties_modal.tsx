// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import {TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

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

function generateOptionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFieldOptions(field: PropertyField): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
}

function optionsEqual(a: PropertyFieldOption[], b: PropertyFieldOption[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id || a[i].name !== b[i].name) {
            return false;
        }
    }
    return true;
}

function FieldRow({field, onDeleteRequest}: {
    field: PropertyField;
    onDeleteRequest: (fieldId: string) => void;
}) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();

    const [draftName, setDraftName] = useState(field.name);
    const supportsOptions = field.type === 'select' || field.type === 'multiselect';
    const initialOptions = useMemo(() => getFieldOptions(field), [field]);
    const [draftOptions, setDraftOptions] = useState<PropertyFieldOption[]>(initialOptions);

    useEffect(() => {
        setDraftOptions(initialOptions);
    }, [initialOptions]);

    const trimmed = draftName.trim();
    const nameDirty = trimmed !== field.name;
    const nameValid = trimmed.length > 0;
    const trimmedOptions = useMemo(
        () => draftOptions.map((o) => ({...o, name: o.name.trim()})),
        [draftOptions],
    );
    const optionsDirty = supportsOptions && !optionsEqual(initialOptions, trimmedOptions);
    const optionsValid = !supportsOptions || (
        trimmedOptions.length > 0 &&
        trimmedOptions.every((o) => o.name.length > 0)
    );
    const canSave = (nameDirty || optionsDirty) && nameValid && optionsValid;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDraftName(e.target.value);
    };

    const handleAddOption = () => {
        setDraftOptions((prev) => [...prev, {id: generateOptionId(), name: ''}]);
    };

    const handleOptionNameChange = (id: string, value: string) => {
        setDraftOptions((prev) => prev.map((o) => (o.id === id ? {...o, name: value} : o)));
    };

    const handleRemoveOption = (id: string) => {
        setDraftOptions((prev) => prev.filter((o) => o.id !== id));
    };

    const handleSave = () => {
        if (!canSave) {
            return;
        }
        const patch: {name?: string; attrs?: PropertyField['attrs']} = {};
        if (nameDirty) {
            patch.name = trimmed;
        }
        if (optionsDirty) {
            patch.attrs = {...(field.attrs ?? {}), options: trimmedOptions};
        }
        dispatch(patchChannelPostPropertyField(field.id, patch));
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
            <div className='manage-post-properties-modal__row-main'>
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
            {supportsOptions && (
                <div className='manage-post-properties-modal__options'>
                    {draftOptions.map((opt, idx) => (
                        <div
                            key={opt.id}
                            className='manage-post-properties-modal__option-row'
                        >
                            <input
                                type='text'
                                aria-label={formatMessage(
                                    {id: 'manage_post_properties_modal.option_name', defaultMessage: 'Option name {n}'},
                                    {n: idx + 1},
                                )}
                                value={opt.name}
                                onChange={(e) => handleOptionNameChange(opt.id, e.target.value)}
                            />
                            <button
                                type='button'
                                className='manage-post-properties-modal__option-remove'
                                aria-label={formatMessage({
                                    id: 'manage_post_properties_modal.remove_option',
                                    defaultMessage: 'Remove option',
                                })}
                                onClick={() => handleRemoveOption(opt.id)}
                            >
                                <TrashCanOutlineIcon size={14}/>
                            </button>
                        </div>
                    ))}
                    <button
                        type='button'
                        className='manage-post-properties-modal__add-option'
                        onClick={handleAddOption}
                    >
                        <FormattedMessage
                            id='manage_post_properties_modal.add_option'
                            defaultMessage='Add option'
                        />
                    </button>
                </div>
            )}
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
