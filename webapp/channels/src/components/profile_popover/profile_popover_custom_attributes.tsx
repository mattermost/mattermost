// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';

import type {CustomAttribute} from '@mattermost/types/admin';

import {Client4} from 'mattermost-redux/client';

type Props = {
    userID: string;
    customAttributes: CustomAttribute[];
    getCustomAttributes: () => void;
}
const ProfilePopoverCustomAttributes = ({
    userID,
    customAttributes,
    getCustomAttributes,
}: Props) => {
    const dispatch = useDispatch();
    const [customAttributeValues, setCustomAttributeValues] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchValues = async () => {
            const response = await Client4.getUserAttributes(userID);
            setCustomAttributeValues(response);
        };
        dispatch(getCustomAttributes());
        fetchValues();
    }, [userID, getCustomAttributes, dispatch]);

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
