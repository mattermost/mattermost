// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

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

function Chip({field, content, hideIcon}: {
    field: PropertyField;
    content: React.ReactNode;
    hideIcon: boolean;
}) {
    return (
        <span
            className='post-property-chip'
            data-property-field-id={field.id}
        >
            {!hideIcon && (
                <span className='post-property-chip__icon'>
                    <PropertyTypeIcon
                        type={field.type}
                        size={14}
                    />
                </span>
            )}
            <span className='post-property-chip__label'>
                {content}
            </span>
        </span>
    );
}

function renderChipsForField(field: PropertyField, raw: unknown): React.ReactNode[] {
    const summary = renderPropertyValue(field, raw);
    if (!summary) {
        return [];
    }

    // For user/multiuser fields the avatar is already part of the rendered
    // summary, so we hide the redundant type icon.
    const hideIcon = field.type === 'user' || field.type === 'multiuser';

    return [
        <Chip
            key={field.id}
            field={field}
            content={summary}
            hideIcon={hideIcon}
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
