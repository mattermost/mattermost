// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import { defineMessage, defineMessages, FormattedMessage } from "react-intl";

import type {
    NameMappedPropertyFields,
    PropertyField,
    PropertyValue,
} from "@mattermost/types/properties";

import PropertyValueRenderer from './propertyValueRenderer/propertyValueRenderer';

import './properties_card_view.scss';

const fieldNameMessages = defineMessages({
    status: {
        id: 'property_card.field.status.label',
        defaultMessage: 'Status',
    },
    reporting_reason: {
        id: 'property_card.field.reporting_reason.label',
        defaultMessage: 'Reason',
    },
    post_preview: {
        id: 'property_card.field.post_preview.label',
        defaultMessage: 'Message',
    },
    reviewer_user_id: {
        id: 'property_card.field.reviewer_user_id.label',
        defaultMessage: 'Reviewer',
    },
    reporting_user_id: {
        id: 'property_card.field.reporting_user_id.label',
        defaultMessage: 'Flagged by',
    },
    reporting_comment: {
        id: 'property_card.field.reporting_comment.label',
        defaultMessage: 'Comment',
    },
    channel: {
        id: 'property_card.field.channel.label',
        defaultMessage: 'Channel',
    },
    team: {
        id: 'property_card.field.team.label',
        defaultMessage: 'Team',
    },
    post_author: {
        id: 'property_card.field.post_author.label',
        defaultMessage: 'Posted by',
    },
    post_creation_time: {
        id: 'property_card.field.post_creation_time.label',
        defaultMessage: 'Posted at',
    },
});

type Props = {
    title: React.ReactNode;
    propertyFields: NameMappedPropertyFields;
    fieldOrder: Array<PropertyField['id']>;
    shortModeFieldOrder: Array<PropertyField['id']>;
    propertyValues: Array<PropertyValue<unknown>>;
    mode?: 'short' | 'full';
    actionsRow?: React.ReactNode;
}

export default function PropertiesCardView({title, propertyFields, fieldOrder, shortModeFieldOrder, propertyValues, mode, actionsRow}: Props) {
    const orderedRows = useMemo<Array<{field: PropertyField; value: PropertyValue<unknown>}>>(() => {
        console.log('orderedRows');
        if (!Object.keys(propertyFields).length || !fieldOrder.length || !propertyValues.length) {
            return [];
        }

        // const fieldsById = propertyFields.reduce((acc, field) => {
        //     acc[field.id] = field;
        //     return acc;
        // }, {} as {[key: string]: PropertyField});

        const valuesByFieldId = propertyValues.reduce((acc, value) => {
            acc[value.field_id] = value;
            return acc;
        }, {} as {[key: string]: PropertyValue<unknown>});

        const fieldOrderToUse = mode === 'short' ? shortModeFieldOrder : fieldOrder;
        return fieldOrderToUse.map((fieldName) => {
            const field = propertyFields[fieldName];
            if (!field) {
                return null;
            }

            const value = valuesByFieldId[field.id];

            return {
                field,
                value,
            };
        }).filter((entry) => Boolean(entry.value));
    }, [fieldOrder, mode, propertyFields, propertyValues, shortModeFieldOrder]);

    if (orderedRows.length === 0) {
        console.log('Hey!');
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
                                    <FormattedMessage {...fieldNameMessages[field.name as keyof typeof fieldNameMessages]}/>
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
