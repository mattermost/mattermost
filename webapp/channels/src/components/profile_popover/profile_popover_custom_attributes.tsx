// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getCustomProfileAttributeFields} from 'mattermost-redux/actions/general';
import {Client4} from 'mattermost-redux/client';
import {getCustomProfileAttributes} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

type Props = {
    userID: string;
}
const ProfilePopoverCustomAttributes = ({
    userID,
}: Props) => {
    const dispatch = useDispatch();
    const [customAttributeValues, setCustomAttributeValues] = useState<Record<string, string>>({});
    const customProfileAttributeFields = useSelector((state: GlobalState) => getCustomProfileAttributes(state));

    useEffect(() => {
        const fetchValues = async () => {
            const response = await Client4.getUserCustomProfileAttributesValues(userID);
            setCustomAttributeValues(response);
        };
        dispatch(getCustomProfileAttributeFields());
        fetchValues();
    }, [userID, dispatch]);
    const attributeSections = Object.values(customProfileAttributeFields).map((attribute) => {
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
                    id={`user-popover__custom_attributes-title-${attribute.id}`}
                    className='user-popover__subtitle'
                >
                    {attribute.name}
                </strong>
                <p
                    aria-labelledby={`user-popover__custom_attributes-title-${attribute.id}`}
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
