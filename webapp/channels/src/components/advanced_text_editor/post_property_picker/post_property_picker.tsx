// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PopoverActions} from '@mui/material/Popover';
import classNames from 'classnames';
import React, {memo, useCallback, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CloseIcon, PencilOutlineIcon, PlusIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

import {deleteChannelPostPropertyField, patchChannelPostPropertyField} from 'mattermost-redux/actions/properties';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import CompassDesignProvider from 'components/compass_design_provider';
import ConfirmModal from 'components/confirm_modal';
import * as Menu from 'components/menu';
import PropertyTypeIcon from 'components/property_value_editor/type_icon';

import type {DispatchFunc} from 'types/store';

import NewPropertyForm from './new_property_form';
import type {NewPropertyData} from './new_property_form';
import {buildPropertyFieldPatch, fieldToFormData} from './property_field_form_utils';

import './post_property_picker.scss';

const MENU_WIDTH = '320px';

export type Props = {
    fields: PropertyField[];
    stagedFieldIds: string[];
    onToggleStaged: (fieldId: string) => void;
    onCreateField?: (data: NewPropertyData) => Promise<void>;
    onAddNewClick?: () => void;
    onManageClick?: () => void;
    disabled: boolean;
    mode?: 'staging' | 'rhs';
};

function PostPropertyPicker({fields, stagedFieldIds, onToggleStaged, onCreateField, onAddNewClick, onManageClick, disabled, mode = 'staging'}: Props) {
    const {formatMessage} = useIntl();
    const theme = useSelector(getTheme);
    const dispatch = useDispatch<DispatchFunc>();

    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [inAddNewMode, setInAddNewMode] = useState(false);
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const popoverActionRef = useRef<PopoverActions | null>(null);

    const pendingDeleteField = pendingDeleteId ?
        fields.find((f) => f.id === pendingDeleteId) :
        undefined;

    const handleConfirmDelete = useCallback(() => {
        if (pendingDeleteId) {
            dispatch(deleteChannelPostPropertyField(pendingDeleteId));
            setPendingDeleteId(null);
        }
    }, [dispatch, pendingDeleteId]);

    const handleCancelDelete = useCallback(() => {
        setPendingDeleteId(null);
    }, []);

    const handleFormLayoutChange = useCallback(() => {
        // Re-anchor the popover so it grows upward (per anchor/transform origin)
        // instead of overflowing the viewport when the form resizes.
        popoverActionRef.current?.updatePosition();
    }, []);

    const stagedSet = new Set(stagedFieldIds);

    const triggerLabel = formatMessage({
        id: 'post_property_picker.trigger',
        defaultMessage: 'Add property',
    });
    const searchPlaceholder = formatMessage({
        id: 'post_property_picker.search_placeholder',
        defaultMessage: 'Search properties',
    });

    const handleSelect = useCallback((fieldId: string) => {
        onToggleStaged(fieldId);
    }, [onToggleStaged]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    }, []);

    const stopPropagationOnKey = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
        // Prevent the menu from intercepting typing keys (Esc still bubbles to close).
        if (e.key !== 'Escape') {
            e.stopPropagation();
        }
    }, []);

    const handleAddNewClick = useCallback(() => {
        if (onCreateField) {
            setEditingFieldId(null);
            setInAddNewMode(true);
            return;
        }
        onAddNewClick?.();
    }, [onCreateField, onAddNewClick]);

    const handleCancelAddNew = useCallback(() => {
        setInAddNewMode(false);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingFieldId(null);
    }, []);

    const handleSaveEdit = useCallback(async (data: NewPropertyData) => {
        if (!editingFieldId) {
            return;
        }
        const field = fields.find((f) => f.id === editingFieldId);
        if (!field) {
            return;
        }

        const patch = buildPropertyFieldPatch(field, data);
        if (patch) {
            await dispatch(patchChannelPostPropertyField(editingFieldId, patch));
        }
        setEditingFieldId(null);
    }, [dispatch, editingFieldId, fields]);

    const editingField = editingFieldId ?
        fields.find((f) => f.id === editingFieldId) :
        undefined;
    const showingForm = (inAddNewMode && onCreateField) || Boolean(editingField);

    const handleSaveNew = useCallback(async (data: NewPropertyData) => {
        if (!onCreateField) {
            return;
        }
        await onCreateField(data);
        setInAddNewMode(false);
    }, [onCreateField]);

    const filteredFields = searchQuery.trim() === '' ?
        fields :
        fields.filter((f) => f.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));

    const items = filteredFields.map((field) => {
        const leadingElement = (
            <span className='post-property-picker__row-icon'>
                <PropertyTypeIcon type={field.type}/>
            </span>
        );

        const trailingActions = (
            <span className='post-property-picker__row-actions'>
                <button
                    type='button'
                    className='post-property-picker__edit-btn'
                    aria-label={formatMessage(
                        {id: 'post_property_picker.edit_aria', defaultMessage: 'Edit {name}'},
                        {name: field.name},
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        setInAddNewMode(false);
                        setEditingFieldId(field.id);
                    }}
                >
                    <PencilOutlineIcon size={16}/>
                </button>
                <button
                    type='button'
                    className='post-property-picker__delete-btn'
                    aria-label={formatMessage(
                        {id: 'post_property_picker.delete_aria', defaultMessage: 'Delete {name}'},
                        {name: field.name},
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteId(field.id);
                    }}
                >
                    <CloseIcon size={16}/>
                </button>
            </span>
        );

        if (mode === 'rhs') {
            return (
                <Menu.Item
                    key={field.id}
                    id={`post-property-picker-item-${field.id}`}
                    leadingElement={leadingElement}
                    onClick={() => handleSelect(field.id)}
                    labels={<span>{field.name}</span>}
                    trailingElements={trailingActions}
                />
            );
        }

        const checked = stagedSet.has(field.id);
        return (
            <Menu.Item
                key={field.id}
                id={`post-property-picker-item-${field.id}`}
                role='menuitemcheckbox'
                aria-checked={checked}
                leadingElement={leadingElement}
                onClick={() => handleSelect(field.id)}
                labels={<span>{field.name}</span>}
                trailingElements={trailingActions}
            />
        );
    });

    const triggerButton = mode === 'rhs' ? (
        <button
            type='button'
            className={classNames('rhs-post-properties-panel__add-property', {'rhs-post-properties-panel__add-property--active': open})}
            disabled={disabled}
            aria-label={triggerLabel}
        >
            <FormattedMessage
                id='post_property_picker.add_property_rhs'
                defaultMessage='+ Add property'
            />
        </button>
    ) : (
        <button
            type='button'
            className={classNames('post-property-picker__trigger', {'post-property-picker__trigger--active': open})}
            disabled={disabled}
            aria-label={triggerLabel}
        >
            <PlusIcon size={14}/>
            <span className='post-property-picker__trigger-label'>
                <FormattedMessage
                    id='post_property_picker.add_property_cta'
                    defaultMessage='Add property'
                />
            </span>
        </button>
    );

    const showEmptyState = fields.length === 0;
    const showNoMatches = !showEmptyState && filteredFields.length === 0;

    const handleMenuToggle = useCallback((next: boolean) => {
        setOpen(next);
        if (!next) {
            setInAddNewMode(false);
            setSearchQuery('');
            setEditingFieldId(null);
        }
    }, []);

    return (
        <CompassDesignProvider theme={theme}>
            <Menu.Container
                menuButton={{
                    id: 'postPropertyPickerButton',
                    as: 'div',
                    class: classNames('style--none', 'post-property-picker__menu-anchor'),
                    children: triggerButton,
                }}
                menu={{
                    id: 'post-property-picker-menu',
                    'aria-label': triggerLabel,
                    width: MENU_WIDTH,
                    className: 'post-property-picker__menu',
                    onToggle: handleMenuToggle,
                    isMenuOpen: open,
                }}
                menuButtonTooltip={{
                    text: triggerLabel,
                }}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                popoverAction={popoverActionRef}
            >
                {showingForm ? [
                    (
                        <li
                            key='post-property-picker-form'
                            className='post-property-picker__form-wrapper'
                            onKeyDown={stopPropagationOnKey}
                            onKeyUp={stopPropagationOnKey}
                        >
                            <NewPropertyForm
                                key={editingField?.id ?? 'new'}
                                initialValues={editingField ? fieldToFormData(editingField) : undefined}
                                onSave={editingField ? handleSaveEdit : handleSaveNew}
                                onCancel={editingField ? handleCancelEdit : handleCancelAddNew}
                                onLayoutChange={handleFormLayoutChange}
                            />
                        </li>
                    ),
                ] : [
                    (
                        <li
                            key='post-property-picker-search'
                            className='post-property-picker__search-wrapper'
                        >
                            <input
                                type='text'
                                className='post-property-picker__search'
                                placeholder={searchPlaceholder}
                                aria-label={searchPlaceholder}
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onKeyDown={stopPropagationOnKey}
                                onKeyUp={stopPropagationOnKey}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </li>
                    ),
                    showEmptyState && (
                        <Menu.Item
                            key='post-property-picker-empty'
                            id='post-property-picker-empty'
                            disabled={true}
                            labels={
                                <span className='post-property-picker__empty'>
                                    <FormattedMessage
                                        id='post_property_picker.empty'
                                        defaultMessage='No properties yet for this channel'
                                    />
                                </span>
                            }
                        />
                    ),
                    showNoMatches && (
                        <Menu.Item
                            key='post-property-picker-no-matches'
                            id='post-property-picker-no-matches'
                            disabled={true}
                            labels={
                                <span className='post-property-picker__empty'>
                                    <FormattedMessage
                                        id='post_property_picker.no_matches'
                                        defaultMessage='No properties match your search'
                                    />
                                </span>
                            }
                        />
                    ),
                    ...(!showEmptyState && !showNoMatches ? items : []),
                    <Menu.Separator key='post-property-picker-separator'/>,
                    (
                        <Menu.Item
                            key='post-property-picker-add-new'
                            id='post-property-picker-add-new'
                            leadingElement={(
                                <span className='post-property-picker__row-icon'>
                                    <PlusIcon size={16}/>
                                </span>
                            )}
                            labels={(
                                <span>
                                    <FormattedMessage
                                        id='post_property_picker.add_new'
                                        defaultMessage='Add new property'
                                    />
                                </span>
                            )}
                            disableCloseOnSelect={Boolean(onCreateField)}
                            onClick={() => handleAddNewClick()}
                        />
                    ),
                    onManageClick && (
                        <Menu.Item
                            key='post-property-picker-manage'
                            id='post-property-picker-manage'
                            onClick={onManageClick}
                            labels={(
                                <span>
                                    <FormattedMessage
                                        id='post_property_picker.manage'
                                        defaultMessage='Manage properties'
                                    />
                                </span>
                            )}
                        />
                    ),
                ]}
            </Menu.Container>
            <ConfirmModal
                show={pendingDeleteId !== null}
                title={
                    <FormattedMessage
                        id='post_property_picker.confirm_delete_title'
                        defaultMessage='Delete property'
                    />
                }
                message={
                    <FormattedMessage
                        id='post_property_picker.confirm_delete_message'
                        defaultMessage='Delete property "{name}"? Existing values on posts will be removed.'
                        values={{name: pendingDeleteField?.name ?? ''}}
                    />
                }
                confirmButtonVariant='destructive'
                confirmButtonText={
                    <FormattedMessage
                        id='post_property_picker.confirm_delete'
                        defaultMessage='Delete'
                    />
                }
                cancelButtonText={
                    <FormattedMessage
                        id='post_property_picker.cancel_delete'
                        defaultMessage='Cancel'
                    />
                }
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                isStacked={true}
            />
        </CompassDesignProvider>
    );
}

export default memo(PostPropertyPicker);
