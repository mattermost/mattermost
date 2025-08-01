// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {PropertyValue} from '@mattermost/types/properties';

import './selectPropertyRenderer.scss';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

type Props = {
    value: PropertyValue<unknown>;
}

export function UserPropertyRenderer({value}: Props) {
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

    return (
        <span className='UserPropertyRenderer'>
            {user?.username}
        </span>
    );
}
