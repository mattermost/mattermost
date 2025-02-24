// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {UserPropertyField} from '@mattermost/types/properties';

import {getCustomProfileAttributeValues} from 'mattermost-redux/actions/users';
import {getCustomProfileAttributes} from 'mattermost-redux/selectors/entities/general';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import type {CPASelectOption} from 'components/user_settings/general/user_settings_general';

import type {GlobalState} from 'types/store';

import ProfilePopoverPhone from './profile_popover_phone';
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

    const getDisplayValue = (attribute: UserPropertyField, attributeValue: string | string[]) => {
        if (!attributeValue || (!Array.isArray(attributeValue) && !attributeValue.length)) {
            return '';
        }

        if (attribute.type === 'select' || attribute.type === 'multiselect') {
            const attribOptions: CPASelectOption[] = attribute.attrs!.options as CPASelectOption[];
            if (Array.isArray(attributeValue)) {
                return attributeValue.map((value) => {
                    const option = attribOptions.find((o) => o.ID === value);
                    return option?.Name;
                }).join(',');
            }

            // Handle single select
            const option = attribOptions.find((o) => o.ID === attributeValue);
            return option?.Name;
        }

        return attributeValue as string;
    };

    const attributeSections = Object.values(customProfileAttributeFields).map((attribute) => {
        if (!hideStatus && userProfile.custom_profile_attributes) {
            const visibility = attribute.attrs?.visibility || 'when-set';
            if (visibility === 'never') {
                return null;
            }
            const value = getDisplayValue(attribute, userProfile.custom_profile_attributes[attribute.id]);

            if (!value && visibility === 'when-set') {
                return null;
            }

            const valueType = attribute.attrs?.value_type || '';
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
                    {valueType === 'phone' && (
                        <ProfilePopoverPhone phone={value}/>
                    )}
                    {valueType === 'url' && (
                        <ProfilePopoverUrl url={value}/>
                    )}
                    {valueType === '' && (
                        <p
                            aria-labelledby={`user-popover__custom_attributes-title-${attribute.id}`}
                            className='user-popover__subtitle-text'
                        >
                            {value || ''}
                        </p>
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
