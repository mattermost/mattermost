// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getCustomProfileAttributeValues} from 'mattermost-redux/actions/users';
import {getCustomProfileAttributes} from 'mattermost-redux/selectors/entities/general';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

type Props = {
    userID: string;
}
const ProfilePopoverCustomAttributes = ({
    userID,
}: Props) => {
    const dispatch = useDispatch();
    const userProfile = useSelector((state: GlobalState) => getUser(state, userID));
    const customProfileAttributeFields = useSelector((state: GlobalState) => getCustomProfileAttributes(state));

    useEffect(() => {
        if (!userProfile.custom_profile_attributes) {
            dispatch(getCustomProfileAttributeValues(userID));
        }
    });
    const attributeSections = customProfileAttributeFields.map((attribute) => {
        if (userProfile.custom_profile_attributes) {
            const value = userProfile.custom_profile_attributes[attribute.id];
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
        }
        return null;
    });

    return (
        <>{attributeSections}</>
    );
};

export default ProfilePopoverCustomAttributes;
