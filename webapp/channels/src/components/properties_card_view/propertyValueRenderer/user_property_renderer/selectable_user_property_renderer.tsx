// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    PropertyField,
    PropertyValue,
} from '@mattermost/types/properties';

import {UserMultiSelector} from 'components/admin_console/content_flagging/user_multiselector/user_multiselector';

type Props = {
    field: PropertyField;
    value: PropertyValue<unknown>;
}

export function SelectableUserPropertyRenderer({field, value}: Props) {
    return (
        <UserMultiSelector
            id={`selectable-user-property-renderer-${field.id}`}
            onChange={() => {}}
        />
    );
}
