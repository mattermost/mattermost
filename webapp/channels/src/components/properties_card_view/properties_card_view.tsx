// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {
    NameMappedPropertyFields,
    PropertyField,
    PropertyValue,
} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import PropertyValueRenderer from './propertyValueRenderer/propertyValueRenderer';

import './properties_card_view.scss';

export type PostPreviewFieldMetadata = {
    getPost?: (postId: string) => Promise<Post>;
    fetchDeletedPost?: boolean;
    getChannel?: (channelId: string) => Promise<Channel>;
    getTeam?: (teamId: string) => Promise<Team>;
};

export type UserPropertyMetadata = {
    searchUsers?: (term: string) => Promise<UserProfile[]>;
    setUser?: (userId: string) => void;
}

export type TextFieldMetadata = {
    placeholder?: string;
};

export type ChannelFieldMetadata = {
    getChannel?: (channelId: string) => Promise<Channel>;
};

export type TeamFieldMetadata = {
    getTeam?: (teamId: string) => Promise<Team>;
};

export type FieldMetadata = PostPreviewFieldMetadata | TextFieldMetadata | UserPropertyMetadata | ChannelFieldMetadata | TeamFieldMetadata;

export type PropertiesCardViewMetadata = {
    [key: string]: FieldMetadata;
}

type OrderedRow = {
    field: PropertyField;
    value: PropertyValue<unknown>;
};

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
    post_id: {
        id: 'property_card.field.post_id.label',
        defaultMessage: 'Post ID',
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
    reporting_time: {
        id: 'property_card.field.reporting_time.label',
        defaultMessage: 'Flagged at',
    },
    actor_user_id: {
        id: 'property_card.field.actor_user_id.label',
        defaultMessage: 'Reviewed by',
    },
    action_time: {
        id: 'property_card.field.action_time.label',
        defaultMessage: 'Reviewed at',
    },
    actor_comment: {
        id: 'property_card.field.actor_comment.label',
        defaultMessage: 'Reviewer\'s comment',
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
    metadata?: PropertiesCardViewMetadata;
    footer?: React.ReactNode;
}

export default function PropertiesCardView({title, propertyFields, fieldOrder, shortModeFieldOrder, propertyValues, mode, actionsRow, metadata, footer}: Props) {
    const orderedRows = useMemo<OrderedRow[]>(() => {
        const hasRequiredData =
            Object.keys(propertyFields).length > 0 &&
            fieldOrder.length > 0 &&
            propertyValues.length > 0;

        if (!hasRequiredData) {
            return [];
        }

        // Create lookup map for efficient value retrieval
        const valuesByFieldId = new Map(
            propertyValues.map((value) => [value.field_id, value]),
        );

        // Determine which field order to use
        const currentFieldOrder = mode === 'short' ? shortModeFieldOrder : fieldOrder;

        // Build ordered rows, filtering out incomplete entries
        return currentFieldOrder.
            map((fieldName) => {
                const field = propertyFields[fieldName];
                const value = field ? valuesByFieldId.get(field.id) : undefined;

                const allowEmptyValue = field?.attrs?.editable;

                return field && (value || allowEmptyValue) ? {field, value} : null;
            }).
            filter((row): row is OrderedRow => row !== null);
    }, [fieldOrder, mode, propertyFields, propertyValues, shortModeFieldOrder]);

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
                        const translation = fieldNameMessages[field.name as keyof typeof fieldNameMessages];

                        return (
                            <div
                                key={field.id}
                                className='row'
                                data-testid='property-card-row'
                            >
                                <div className='field'>
                                    {translation ? <FormattedMessage {...translation}/> : field.name}
                                </div>

                                <div className='value'>
                                    <PropertyValueRenderer
                                        field={field}
                                        value={value}
                                        metadata={metadata ? metadata[field.name] : undefined}
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

                {footer}
            </div>
        </div>
    );
}
