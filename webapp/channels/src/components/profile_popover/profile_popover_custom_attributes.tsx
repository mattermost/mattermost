// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {CustomAttribute} from '@mattermost/types/admin';

type Props = {
    customAttributes: CustomAttribute[];
    customAttributeValues?: Record<string, string>;
}
const ProfilePopoverCustomAttributes = ({
    customAttributes,
    customAttributeValues,
}: Props) => {
    if (!customAttributeValues) {
        return null;
    }
    const attributeSections = customAttributes.map((attribute) => {
        const value = customAttributeValues[attribute.id];
        if (!value) {
            return null;
        }
        return (
            <div
                key={'customAttribute_' + attribute.id}
                className='user-popover__custom_attributes'
            >
                <strong
                    id='user-popover__custom_attributes-title'
                    className='user-popover__subtitle'
                >
                    {attribute.name}
                </strong>
                <p
                    aria-labelledby='user-popover__custon_attributes-title'
                    className='user-popover__subtitle-text'
                >
                    {value}
                </p>
            </div>
        );
    });
    return (
        <>{attributeSections}</>
    );
};

export default ProfilePopoverCustomAttributes;
