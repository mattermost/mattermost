// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {PlusIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import CompassDesignProvider from 'components/compass_design_provider';
import * as Menu from 'components/menu';
import PropertyTypeIcon from 'components/property_value_editor/type_icon';

import NewPropertyForm from './new_property_form';
import type {NewPropertyData} from './new_property_form';

import './post_property_picker.scss';

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

    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [inAddNewMode, setInAddNewMode] = useState(false);

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
            setInAddNewMode(true);
            return;
        }
        onAddNewClick?.();
    }, [onCreateField, onAddNewClick]);

    const handleCancelAddNew = useCallback(() => {
        setInAddNewMode(false);
    }, []);

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

        if (mode === 'rhs') {
            return (
                <Menu.Item
                    key={field.id}
                    id={`post-property-picker-item-${field.id}`}
                    leadingElement={leadingElement}
                    onClick={() => handleSelect(field.id)}
                    labels={<span>{field.name}</span>}
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
            />
        );
    });

    const triggerButton = mode === 'rhs' ? (
        <button
            type='button'
            id='postPropertyPickerButton'
            className='rhs-post-properties-panel__add-property'
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
            id='postPropertyPickerButton'
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
        }
    }, []);

    return (
        <CompassDesignProvider theme={theme}>
            <Menu.Container
                menuButton={{
                    id: 'postPropertyPickerButton',
                    as: 'div',
                    children: triggerButton,
                }}
                menu={{
                    id: 'post-property-picker-menu',
                    'aria-label': triggerLabel,
                    width: 'max-content',
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
            >
                {inAddNewMode && onCreateField ? [
                    (
                        <li
                            key='post-property-picker-form'
                            className='post-property-picker__form-wrapper'
                            onKeyDown={stopPropagationOnKey}
                            onKeyUp={stopPropagationOnKey}
                        >
                            <NewPropertyForm
                                onSave={handleSaveNew}
                                onCancel={handleCancelAddNew}
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
                        <li
                            key='post-property-picker-add-new'
                            className='post-property-picker__add-new-row'
                        >
                            <button
                                type='button'
                                id='post-property-picker-add-new'
                                className='post-property-picker__add-new-btn'
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddNewClick();
                                }}
                            >
                                <span className='post-property-picker__add-new-icon'>
                                    <PlusIcon size={16}/>
                                </span>
                                <span className='post-property-picker__add-new'>
                                    <FormattedMessage
                                        id='post_property_picker.add_new'
                                        defaultMessage='Add new property'
                                    />
                                </span>
                            </button>
                        </li>
                    ),
                    onManageClick && (
                        <Menu.Item
                            key='post-property-picker-manage'
                            id='post-property-picker-manage'
                            onClick={onManageClick}
                            labels={
                                <span className='post-property-picker__manage'>
                                    <FormattedMessage
                                        id='post_property_picker.manage'
                                        defaultMessage='Manage properties'
                                    />
                                </span>
                            }
                        />
                    ),
                ]}
            </Menu.Container>
        </CompassDesignProvider>
    );
}

export default memo(PostPropertyPicker);
