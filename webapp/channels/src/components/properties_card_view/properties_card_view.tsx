// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

type Props = {
    propertyFields: PropertyField[];
    fieldOrder: Array<PropertyField['id']>;
    propertyValues: Array<PropertyValue<unknown>>;
    mode?: 'short' | 'full';
}

export default function PropertiesCardView({propertyFields, fieldOrder, propertyValues, mode}: Props) {
    const orderedRows = useMemo<Array<{field: PropertyField; value: PropertyValue<unknown>}>>(() => {
        if (!propertyFields.length || !fieldOrder.length || !propertyValues.length) {
            return [];
        }

        const fieldsById = propertyFields.reduce((acc, field) => {
            acc[field.id] = field;
            return acc;
        }, {});

        const valuesByFieldId = propertyValues.reduce((acc, value) => {
            acc[value.field_id] = value;
            return acc;
        }, {});

        return fieldOrder.map((fieldId) => {
            const field = fieldsById[fieldId];
            const value = valuesByFieldId[fieldId];

            console.log('Adding', {field, value});
            return {
                field,
                value,
            };
        });
    }, [fieldOrder, propertyFields, propertyValues]);

    if (orderedRows.length === 0) {
        return null;
    }

    console.log({orderedRows});

    return (
        <div className='PropertyCardView'>
            {
                orderedRows.map(({field, value}) => (
                    <div key={field.id}>
                        <div className='PropertyCardView__field-name'>
                            {field.name}
                        </div>
                        <div className='PropertyCardView__field-value'>
                            {value ? String(value.value) : 'N/A'}
                        </div>
                    </div>
                ))
            }
        </div>
    );
}
