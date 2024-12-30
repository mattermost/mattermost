// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

type Props = {
    userID: string;
    customProfileAttributeFields: PropertyField[];
    getCustomProfileAttributeFields: () => void;
}
const ProfilePopoverCustomAttributes = ({
    userID,
    customProfileAttributeFields,
    getCustomProfileAttributeFields,
}: Props) => {
    const dispatch = useDispatch();
    const [customAttributeValues, setCustomAttributeValues] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchValues = async () => {
            const response = await Client4.getUserCustomProfileAttributesValues(userID);
            setCustomAttributeValues(response);
        };
        dispatch(getCustomProfileAttributeFields());
        fetchValues();
    }, [userID, getCustomProfileAttributeFields, dispatch]);

    const attributeSections = customProfileAttributeFields.map((attribute) => {
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
