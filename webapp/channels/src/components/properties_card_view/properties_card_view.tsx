// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import PropertyValueRenderer from './propertyValueRenderer/propertyValueRenderer';

import './propertyes_card_view.scss';

type Props = {
    title: React.ReactNode;
    propertyFields: PropertyField[];
    fieldOrder: Array<PropertyField['id']>;
    propertyValues: Array<PropertyValue<unknown>>;
    mode?: 'short' | 'full';
}

export default function PropertiesCardView({title, propertyFields, fieldOrder, propertyValues, mode}: Props) {
    const orderedRows = useMemo<Array<{field: PropertyField; value: PropertyValue<unknown>}>>(() => {
        if (!propertyFields.length || !fieldOrder.length || !propertyValues.length) {
            return [];
        }

        const fieldsById = propertyFields.reduce((acc, field) => {
            acc[field.id] = field;
            return acc;
        }, {} as {[key: string]: PropertyField});

        const valuesByFieldId = propertyValues.reduce((acc, value) => {
            acc[value.field_id] = value;
            return acc;
        }, {} as {[key: string]: PropertyValue<unknown>});

        return fieldOrder.map((fieldId) => {
            const field = fieldsById[fieldId];
            const value = valuesByFieldId[fieldId];

            return {
                field,
                value,
            };
        }).filter((entry) => Boolean(entry.value));
    }, [fieldOrder, propertyFields, propertyValues]);

    if (orderedRows.length === 0) {
        return null;
    }

    console.log({orderedRows});

    return (
        <div className='PropertyCardView'>
            <div className='PropertyCardView_title'>
                {title}
            </div>

            <div className='PropertyCardView_fields'>
                {
                    orderedRows.map(({field, value}) => {
                        return (
                            <div
                                key={field.id}
                                className='row'
                            >
                                <div className='field'>
                                    {field.name}
                                </div>

                                <div className='value'>
                                    <PropertyValueRenderer
                                        field={field}
                                        value={value}
                                    />
                                </div>
                            </div>
                        );
                    })
                }
            </div>
        </div>
    );
}
