// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {renderPropertyValue} from 'components/property_value_editor/render_property_value';
import {GLYPH_BY_TYPE} from 'components/property_value_editor/type_icon';
import Tag from 'components/widgets/tag/tag';

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

function Chip({field, content}: {
    field: PropertyField;
    content: React.ReactNode;
}) {
    const text = (
        <>
            <span className='property-chip__name'>{field.name}</span>
            <span className='property-chip__value'>{content}</span>
        </>
    );
    return (
        <Tag
            size='sm'
            icon={GLYPH_BY_TYPE[field.type] ?? 'text-box-outline'}
            text={text}
            data-property-field-id={field.id}
        />
    );
}

function renderChipsForField(field: PropertyField, raw: unknown): React.ReactNode[] {
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
