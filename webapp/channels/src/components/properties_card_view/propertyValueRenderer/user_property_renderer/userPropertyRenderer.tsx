// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {
    PropertyField,
    PropertyValue,
} from '@mattermost/types/properties';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import PreviewPostAvatar from 'components/post_view/post_message_preview/avatar/avatar';
import UserProfileComponent from 'components/user_profile';

import type {GlobalState} from 'types/store';

import './user_property_renderer.scss';
import {SelectableUserPropertyRenderer} from './selectable_user_property_renderer';

type Props = {
    field: PropertyField;
    value: PropertyValue<unknown>;
}

export default function UserPropertyRenderer({field, value}: Props) {
    const dispatch = useDispatch();
    const loaded = useRef<boolean>(false);

    const userId = value.value as string;
    const user = useSelector((state: GlobalState) => getUser(state, userId));

    useEffect(() => {
        if (!loaded.current && userId && !user) {
            dispatch(getMissingProfilesByIds([userId as string]));
            loaded.current = true;
        }
    }, [dispatch, user, userId]);

    if (field.attrs?.editable) {
        return (
            <SelectableUserPropertyRenderer
                field={field}
            />
        );
    }

    return (
        <div
            className='UserPropertyRenderer'
            data-testid='user-property'
        >
            <PreviewPostAvatar
                user={user}
            />
            <UserProfileComponent
                userId={user?.id || ''}
            />
        </div>
    );
}
