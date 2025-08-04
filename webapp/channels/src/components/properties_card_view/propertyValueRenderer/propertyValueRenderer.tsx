// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import PostPreviewPropertyRenderer from './post_preview_property_renderer/post_preview_property_renderer';
import SelectPropertyRenderer from './select_property_renderer/selectPropertyRenderer';
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
        return (<SelectPropertyRenderer value={value}/>);
    default:
        return null;
    }
}
