// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {CloseIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import type {NewPropertyData} from 'components/advanced_text_editor/post_property_picker/new_property_form';
import PostPropertyPicker from 'components/advanced_text_editor/post_property_picker/post_property_picker';
import PropertyValueEditor from 'components/property_value_editor';
import PropertyChipPopover from 'components/property_value_editor/property_chip_popover';
import {renderPropertyValue} from 'components/property_value_editor/render_property_value';
import PropertyTypeIcon from 'components/property_value_editor/type_icon';

import './rhs_post_properties_panel.scss';

export type Props = {
    postId: string;

    // channelId is consumed by the connected wrapper to scope fields; kept on the
    // presentational props for symmetry with PostPropertyChips and to support
    // future channel-scoped affordances inside the panel.
    // eslint-disable-next-line react/no-unused-prop-types
    channelId: string;
    fields: PropertyField[];
    valuesByFieldId: {[fieldId: string]: PropertyValue<unknown>};
    loadPostPropertyValues: (postId: string) => unknown;
    onChangeValue: (fieldId: string, value: unknown) => void;
    onCreateField?: (data: NewPropertyData) => Promise<string | undefined>;
};

function isFilled(raw: unknown): boolean {
    if (raw === null || raw === undefined) {
        return false;
    }
    if (typeof raw === 'string') {
        return raw.length > 0;
    }
    if (Array.isArray(raw)) {
        return raw.length > 0;
    }
    return true;
}

function FieldRow({
    field,
    value,
    onChangeValue,
}: {
    field: PropertyField;
    value: unknown;
    onChangeValue: (fieldId: string, value: unknown) => void;
}) {
    const {formatMessage} = useIntl();

    const handleChange = useCallback((next: unknown) => {
        onChangeValue(field.id, next);
    }, [field.id, onChangeValue]);

    const summary = renderPropertyValue(field, value);
    const editLabel = formatMessage(
        {id: 'rhs_post_properties_panel.edit', defaultMessage: 'Edit {name}'},
        {name: field.name},
    );
    const clearLabel = formatMessage(
        {id: 'rhs_post_properties_panel.clear', defaultMessage: 'Clear {name}'},
        {name: field.name},
    );

    const filled = isFilled(value);

    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onChangeValue(field.id, null);
    }, [field.id, onChangeValue]);

    const trigger = (
        <button
            type='button'
            className='rhs-post-properties-panel__row-trigger'
            aria-label={editLabel}
        >
            {summary ?? (
                <span className='rhs-post-properties-panel__empty'>
                    <FormattedMessage
                        id='rhs_post_properties_panel.empty_value'
                        defaultMessage='Empty'
                    />
                </span>
            )}
        </button>
    );

    return (
        <div
            className='rhs-post-properties-panel__row'
            data-property-field-id={field.id}
        >
            <div className='rhs-post-properties-panel__row-label'>
                <span className='rhs-post-properties-panel__row-icon'>
                    <PropertyTypeIcon type={field.type}/>
                </span>
                <span className='rhs-post-properties-panel__row-name'>{field.name}</span>
            </div>
            <div className='rhs-post-properties-panel__row-value'>
                <PropertyChipPopover trigger={trigger}>
                    {() => (
                        <div className='rhs-post-properties-panel__editor'>
                            <PropertyValueEditor
                                field={field}
                                value={value}
                                onChange={handleChange}
                            />
                        </div>
                    )}
                </PropertyChipPopover>
            </div>
            {filled && (
                <button
                    type='button'
                    className='rhs-post-properties-panel__row-clear'
                    aria-label={clearLabel}
                    onClick={handleClear}
                >
                    <CloseIcon size={14}/>
                </button>
            )}
        </div>
    );
}

export default function RhsPostPropertiesPanel({
    postId,
    fields,
    valuesByFieldId,
    loadPostPropertyValues,
    onChangeValue,
    onCreateField,
}: Props) {
    const [showAll, setShowAll] = useState(false);
    const [locallyAttached, setLocallyAttached] = useState<string[]>([]);

    useEffect(() => {
        loadPostPropertyValues(postId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId]);

    useEffect(() => {
        setLocallyAttached([]);
    }, [postId]);

    const attachedSet = useMemo(() => {
        const set = new Set<string>(Object.keys(valuesByFieldId));
        for (const id of locallyAttached) {
            set.add(id);
        }
        return set;
    }, [valuesByFieldId, locallyAttached]);

    const visibleInCollapsed = fields.filter(
        (f) => isFilled(valuesByFieldId[f.id]?.value) || locallyAttached.includes(f.id),
    );
    const pickerFields = fields.filter((f) => !attachedSet.has(f.id));

    const handleAttach = useCallback((fieldId: string) => {
        setLocallyAttached((current) => (current.includes(fieldId) ? current : [...current, fieldId]));
    }, []);

    const handleCreateField = useCallback(async (data: NewPropertyData) => {
        if (!onCreateField) {
            return;
        }
        const newId = await onCreateField(data);
        if (newId) {
            setLocallyAttached((current) => (current.includes(newId) ? current : [...current, newId]));
        }
    }, [onCreateField]);

    if (fields.length === 0) {
        return null;
    }

    const visibleFields = showAll ? fields : visibleInCollapsed;
    const hasUnfilled = visibleInCollapsed.length < fields.length;

    const toggleShowAll = () => setShowAll((current) => !current);

    return (
        <div className='rhs-post-properties-panel'>
            <div className='rhs-post-properties-panel__rows'>
                {visibleFields.map((field) => (
                    <FieldRow
                        key={field.id}
                        field={field}
                        value={valuesByFieldId[field.id]?.value}
                        onChangeValue={onChangeValue}
                    />
                ))}
            </div>
            <div className='rhs-post-properties-panel__footer'>
                <div className='rhs-post-properties-panel__footer-left'>
                    <PostPropertyPicker
                        mode='rhs'
                        fields={pickerFields}
                        stagedFieldIds={[]}
                        onToggleStaged={handleAttach}
                        onCreateField={onCreateField ? handleCreateField : undefined}
                        disabled={false}
                    />
                </div>
                {hasUnfilled && (
                    <button
                        type='button'
                        className='rhs-post-properties-panel__toggle'
                        onClick={toggleShowAll}
                    >
                        {showAll ? (
                            <FormattedMessage
                                id='rhs_post_properties_panel.show_less'
                                defaultMessage='Show less'
                            />
                        ) : (
                            <FormattedMessage
                                id='rhs_post_properties_panel.show_all'
                                defaultMessage='Show all'
                            />
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
