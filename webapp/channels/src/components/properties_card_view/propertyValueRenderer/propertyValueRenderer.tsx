// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import ChannelPropertyRenderer from './channel_property_renderer/channel_property_renderer';
import PostPreviewPropertyRenderer from './post_preview_property_renderer/post_preview_property_renderer';
import SelectPropertyRenderer from './select_property_renderer/selectPropertyRenderer';
import TeamPropertyRenderer from './team_property_renderer/team_property_renderer';
import TextPropertyRenderer from './text_property_renderer/textPropertyRenderer';
import UserPropertyRenderer from './user_property_renderer/userPropertyRenderer';

import './property_value_renderer.scss';

type Props = {
    field: PropertyField;
    value: PropertyValue<unknown>;
}

export default function PropertyValueRenderer({field, value}: Props) {
    switch (field.type) {
    case 'text':
        return (<TextPropertyRenderer value={value}/>);
    case 'user':
        return (<UserPropertyRenderer value={value}/>);
    case 'post':
        return (<PostPreviewPropertyRenderer value={value}/>);
    case 'select':
        return (
            <SelectPropertyRenderer
                value={value}
                field={field}
            />
        );
    case 'channel':
        return (<ChannelPropertyRenderer value={value}/>);
    case 'team':
        return (<TeamPropertyRenderer value={value}/>);
    default:
        return null;
    }
}
