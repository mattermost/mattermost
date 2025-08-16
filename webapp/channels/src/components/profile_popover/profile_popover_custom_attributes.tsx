// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {UserPropertyValueType} from '@mattermost/types/properties';

import {getCustomProfileAttributeValues} from 'mattermost-redux/actions/users';
import {getCustomProfileAttributes} from 'mattermost-redux/selectors/entities/general';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import ProfilePopoverPhone from './profile_popover_phone';
import ProfilePopoverSelectAttribute from './profile_popover_select_attribute';
import ProfilePopoverTextAttribute from './profile_popover_text_attribute';
import ProfilePopoverUrl from './profile_popover_url';

type Props = {
    userID: string;
    hideStatus?: boolean;
}
const ProfilePopoverCustomAttributes = ({
    userID,
    hideStatus = false,
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
        if (!hideStatus && userProfile.custom_profile_attributes) {
            const visibility = attribute.attrs?.visibility || 'when_set';
            if (visibility === 'hidden') {
                return null;
            }

            // Check if the attribute has a value
            const hasValue = userProfile.custom_profile_attributes[attribute.id]?.length > 0;

            if (!hasValue && visibility === 'when_set') {
                return null;
            } else if (visibility === 'when_set' && (attribute.type === 'multiselect' || attribute.type === 'select')) {
                const attributeValue = userProfile.custom_profile_attributes[attribute.id];

                // make sure attribute contains legitimate values
                if (Array.isArray(attributeValue)) {
                    // Handle multiselect
                    const options = attributeValue.map((value) => {
                        return attribute.attrs.options?.find((o) => o.id === value);
                    }).filter((o) => o != null);
                    if (options.length === 0) {
                        return null;
                    }
                } else {
                    // Handle single select
                    const option = attribute.attrs.options?.find((o) => o.id === attributeValue);
                    if (option === undefined) {
                        return null;
                    }
                }
            }

            const valueType = (attribute.attrs?.value_type as UserPropertyValueType) || '';
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
                    {(attribute.type === 'multiselect' || attribute.type === 'select') && (
                        <ProfilePopoverSelectAttribute
                            attribute={attribute}
                            userProfile={userProfile}
                        />
                    )}
                    {attribute.type === 'text' && valueType === 'phone' && (
                        <ProfilePopoverPhone
                            attribute={attribute}
                            userProfile={userProfile}
                        />
                    )}
                    {attribute.type === 'text' && valueType === 'url' && (
                        <ProfilePopoverUrl
                            attribute={attribute}
                            userProfile={userProfile}
                        />
                    )}
                    {attribute.type === 'text' && valueType === '' && (
                        <ProfilePopoverTextAttribute
                            attribute={attribute}
                            userProfile={userProfile}
                        />
                    )}
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
