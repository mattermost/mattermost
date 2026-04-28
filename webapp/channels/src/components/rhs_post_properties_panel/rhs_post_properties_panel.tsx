// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import PostPropertyPicker from 'components/advanced_text_editor/post_property_picker/post_property_picker';
import PropertyValueEditor from 'components/property_value_editor';

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
    const handleChange = useCallback((next: unknown) => {
        onChangeValue(field.id, next);
    }, [field.id, onChangeValue]);

    return (
        <div
            className='rhs-post-properties-panel__row'
            data-property-field-id={field.id}
        >
            <div className='rhs-post-properties-panel__row-label'>
                {field.name}
            </div>
            <div className='rhs-post-properties-panel__row-editor'>
                <PropertyValueEditor
                    field={field}
                    value={value}
                    onChange={handleChange}
                />
            </div>
        </div>
    );
}

const NOOP = () => {};

export default function RhsPostPropertiesPanel({
    postId,
    fields,
    valuesByFieldId,
    loadPostPropertyValues,
    onChangeValue,
}: Props) {
    const [showAll, setShowAll] = useState(false);
    const [locallyAttached, setLocallyAttached] = useState<string[]>([]);

    useEffect(() => {
        loadPostPropertyValues(postId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId]);

    // Reset locally-attached fields when switching posts so a stale set doesn't
    // leak across selections.
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

    if (fields.length === 0) {
        return null;
    }

    const visibleFields = showAll ? fields : visibleInCollapsed;
    const hasUnfilled = visibleInCollapsed.length < fields.length;

    const toggleShowAll = () => setShowAll((current) => !current);

    return (
        <div className='rhs-post-properties-panel'>
            <div className='rhs-post-properties-panel__header'>
                <FormattedMessage
                    id='rhs_post_properties_panel.title'
                    defaultMessage='Properties'
                />
            </div>
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
            <div className='rhs-post-properties-panel__add-row'>
                <PostPropertyPicker
                    mode='rhs'
                    fields={pickerFields}
                    stagedFieldIds={[]}
                    onToggleStaged={handleAttach}
                    onAddNewClick={NOOP}
                    disabled={false}
                />
            </div>
        </div>
    );
}
