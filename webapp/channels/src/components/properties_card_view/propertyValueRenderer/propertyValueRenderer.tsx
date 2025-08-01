// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {SelectPropertyRenderer} from 'components/properties_card_view/propertyValueRenderer/selectPropertyRenderer';
import {TextPropertyRenderer} from 'components/properties_card_view/propertyValueRenderer/textPropertyRenderer';
import {UserPropertyRenderer} from 'components/properties_card_view/propertyValueRenderer/userPropertyRenderer';

import './selectPropertyRenderer.scss';

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
    case 'select':
        return (<SelectPropertyRenderer value={value}/>);
    default:
        return null;
    }
}
