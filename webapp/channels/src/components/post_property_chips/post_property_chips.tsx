// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';

import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';

import {renderPropertyValue} from 'components/property_value_editor/render_property_value';
import PropertyTypeIcon from 'components/property_value_editor/type_icon';

import './post_property_chips.scss';

export type Props = {
    postId: string;
    fields: PropertyField[];
    valuesByFieldId: {[fieldId: string]: PropertyValue<unknown>};
    loadPostPropertyValues: (postId: string) => unknown;
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

function getOptions(field: PropertyField): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
}

function Chip({field, content, optionColor}: {
    field: PropertyField;
    content: React.ReactNode;
    optionColor?: string;
}) {
    const style: React.CSSProperties = optionColor ? {backgroundColor: optionColor} : {};
    return (
        <span
            className='property-chip'
            data-property-field-id={field.id}
            style={style}
        >
            <span className='property-chip__icon'>
                <PropertyTypeIcon type={field.type}/>
            </span>
            <span className='property-chip__value'>{content}</span>
        </span>
    );
}

function renderChipsForField(field: PropertyField, raw: unknown): React.ReactNode[] {
    if (field.type === 'multiselect' && Array.isArray(raw)) {
        const options = getOptions(field);
        return raw.
            map((id) => options.find((opt) => opt.id === id)).
            filter((opt): opt is PropertyFieldOption => Boolean(opt)).
            map((opt) => (
                <Chip
                    key={`${field.id}:${opt.id}`}
                    field={field}
                    content={opt.name}
                    optionColor={opt.color}
                />
            ));
    }

    const summary = renderPropertyValue(field, raw);
    if (!summary) {
        return [];
    }
    return [
        <Chip
            key={field.id}
            field={field}
            content={summary}
        />,
    ];
}

export default function PostPropertyChips({postId, fields, valuesByFieldId, loadPostPropertyValues}: Props) {
    useEffect(() => {
        loadPostPropertyValues(postId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId]);

    const renderedChips = fields.flatMap((field) => {
        const value = valuesByFieldId[field.id];
        if (!value || !isFilled(value.value)) {
            return [];
        }
        return renderChipsForField(field, value.value);
    });

    if (renderedChips.length === 0) {
        return null;
    }

    return (
        <div className='post__property-chips'>
            {renderedChips}
        </div>
    );
}
