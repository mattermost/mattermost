// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import PropertyValueRenderer from './propertyValueRenderer/propertyValueRenderer';

import './properties_card_view.scss';

type Props = {
    title: React.ReactNode;
    propertyFields: PropertyField[];
    fieldOrder: Array<PropertyField['id']>;
    shortModeFieldOrder: Array<PropertyField['id']>;
    propertyValues: Array<PropertyValue<unknown>>;
    mode?: 'short' | 'full';
    actionsRow?: React.ReactNode;
}

export default function PropertiesCardView({title, propertyFields, fieldOrder, shortModeFieldOrder, propertyValues, mode, actionsRow}: Props) {
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

        const fieldOrderToUse = mode === 'short' ? shortModeFieldOrder : fieldOrder;
        return fieldOrderToUse.map((fieldId) => {
            const field = fieldsById[fieldId];
            const value = valuesByFieldId[fieldId];

            return {
                field,
                value,
            };
        }).filter((entry) => Boolean(entry.value));
    }, [fieldOrder, mode, propertyFields, propertyValues, shortModeFieldOrder]);

    if (orderedRows.length === 0) {
        return null;
    }

    return (
        <div
            className='PropertyCardView'
            data-testid='property-card-view'
        >
            <div
                className='PropertyCardView_title'
                data-testid='property-card-title'
            >
                {title}
            </div>

            <div className='PropertyCardView_fields'>
                {
                    orderedRows.map(({field, value}) => {
                        return (
                            <div
                                key={field.id}
                                className='row'
                                data-testid='property-card-row'
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

                {
                    mode === 'full' && actionsRow &&
                    <div className='row'>
                        <div className='field'>
                            <FormattedMessage
                                id='property_card.actions_row.label'
                                defaultMessage='Actions'
                            />
                        </div>

                        <div className='value'>
                            {actionsRow}
                        </div>
                    </div>
                }
            </div>
        </div>
    );
}
