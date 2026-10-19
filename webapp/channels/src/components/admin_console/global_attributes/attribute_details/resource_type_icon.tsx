// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {RESOURCE_TYPE_ICONS} from './attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_applies_to_constants';

import './resource_type_icon.scss';

type Props = {
    type: ResourceObjectType;
};

// Compass Icon at 16px draws the SVG at 18px so the glyph's built-in
// clear-space is cropped. Without that, Product Channels reads as a muddy
// circle instead of the chat bubble used in the proto.
const SVG_SIZE = 18;

export default function ResourceTypeIcon({type}: Props) {
    const Icon = RESOURCE_TYPE_ICONS[type];

    return (
        <span
            className='GlobalAttributesResourceIcon'
            aria-hidden={true}
        >
            <Icon size={SVG_SIZE}/>
        </span>
    );
}
