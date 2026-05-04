// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    AccountOutlineIcon,
    CalendarOutlineIcon,
    CheckCircleOutlineIcon,
    FormatListBulletedIcon,
    TextBoxOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

type Props = {
    type: PropertyField['type'];
    size?: number;
};

type IconComponent = React.FC<{size?: number | string; color?: string; className?: string}>;

const ICON_BY_TYPE: Record<string, IconComponent> = {
    text: TextBoxOutlineIcon,
    date: CalendarOutlineIcon,
    select: CheckCircleOutlineIcon,
    multiselect: FormatListBulletedIcon,
    user: AccountOutlineIcon,
};

export default function PropertyTypeIcon({type, size = 16}: Props) {
    const resolved = ICON_BY_TYPE[type] ? type : 'text';
    const Icon = ICON_BY_TYPE[resolved];
    return (
        <span
            className={`property-type-icon property-type-icon--${resolved}`}
            data-property-type={resolved}
        >
            <Icon size={size}/>
        </span>
    );
}
