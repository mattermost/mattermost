// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    PropertyField,
    PropertyValue,
} from '@mattermost/types/properties';

import type {
    ChannelFieldMetadata,
    FieldMetadata,
    PostPreviewFieldMetadata,
    TeamFieldMetadata,
    TextFieldMetadata,
    UserPropertyMetadata,
} from 'components/properties_card_view/properties_card_view';

import ChannelPropertyRenderer from './channel_property_renderer/channel_property_renderer';
import PostPreviewPropertyRenderer from './post_preview_property_renderer/post_preview_property_renderer';
import SelectPropertyRenderer from './select_property_renderer/selectPropertyRenderer';
import TeamPropertyRenderer from './team_property_renderer/team_property_renderer';
import TextPropertyRenderer from './text_property_renderer/textPropertyRenderer';
import TimestampPropertyRenderer from './timestamp_property_renderer/timestamp_property_renderer';
import UserPropertyRenderer from './user_property_renderer/userPropertyRenderer';

import './property_value_renderer.scss';

type Props = {
    field: PropertyField;
    value: PropertyValue<unknown>;
    metadata?: FieldMetadata;
};

export default function PropertyValueRenderer({field, value, metadata}: Props) {
    switch (field.type) {
    case 'text':
        return (
            <RenderTextSubtype
                field={field}
                value={value}
                metadata={metadata}
            />
        );
    case 'user':
        return (
            <UserPropertyRenderer
                field={field}
                value={value}
                metadata={metadata as UserPropertyMetadata}
            />
        );
    case 'select':
        return (
            <SelectPropertyRenderer
                value={value}
                field={field}
            />
        );
    default:
        return null;
    }
}

function RenderTextSubtype({field, value, metadata}: Props) {
    if (field.type !== 'text') {
        return null;
    }

    const subType = field.attrs?.subType ?? 'text';
    switch (subType) {
    case 'text':
        return (
            <TextPropertyRenderer
                value={value}
                metadata={metadata as TextFieldMetadata}
            />
        );
    case 'post':
        return (
            <PostPreviewPropertyRenderer
                value={value}
                metadata={metadata as PostPreviewFieldMetadata}
            />
        );
    case 'channel':
        return (
            <ChannelPropertyRenderer
                value={value}
                metadata={metadata as ChannelFieldMetadata}
            />
        );
    case 'team':
        return (
            <TeamPropertyRenderer
                value={value}
                metadata={metadata as TeamFieldMetadata}
            />
        );
    case 'timestamp':
        return <TimestampPropertyRenderer value={value}/>;
    default:
        return null;
    }
}
