// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {UserPropertyField, UserPropertyValueType} from '@mattermost/types/properties';

import {getCustomProfileAttributeValues} from 'mattermost-redux/actions/users';
import {getCustomProfileAttributes} from 'mattermost-redux/selectors/entities/general';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {getUserPropertyFieldLabel} from 'utils/properties';

import type {GlobalState} from 'types/store';

import ProfilePopoverPhone from './profile_popover_phone';
import ProfilePopoverSelectAttribute from './profile_popover_select_attribute';
import ProfilePopoverTextAttribute from './profile_popover_text_attribute';
import ProfilePopoverUrl from './profile_popover_url';

type Props = {
    userID: string;
    hideStatus?: boolean;
}

const hasDisplayableAttributeValue = (attribute: UserPropertyField, customProfileAttributes: Record<string, string | string[]>): boolean => {
    const attributeValue = customProfileAttributes[attribute.id];
    if (Array.isArray(attributeValue)) {
        if (attributeValue.length === 0) {
            return false;
        }
    } else if (!attributeValue) {
        return false;
    }

    if (attribute.type === 'multiselect' || attribute.type === 'select') {
        const options = attribute.attrs?.options;
        if (!options?.length) {
            return false;
        }

        if (Array.isArray(attributeValue)) {
            return attributeValue.some((value) => options.some((option) => option.id === value));
        }

        return options.some((option) => option.id === attributeValue);
    }

    return true;
};

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
    }, [dispatch, userID, userProfile.custom_profile_attributes]);

    const attributeSections = customProfileAttributeFields.map((attribute) => {
        if (!hideStatus && userProfile.custom_profile_attributes) {
            // Hide source_only fields from profile popover
            if (attribute.attrs?.access_mode === 'source_only') {
                return null;
            }

            const visibility = attribute.attrs?.visibility || 'when_set';
            if (visibility === 'hidden') {
                return null;
            }

            if (!hasDisplayableAttributeValue(attribute, userProfile.custom_profile_attributes)) {
                return null;
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
                        {getUserPropertyFieldLabel(attribute)}
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
