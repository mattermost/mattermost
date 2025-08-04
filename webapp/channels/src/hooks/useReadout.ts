// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {setReadout} from 'actions/views/root';

export const useReadout = () => {
    const dispatch = useDispatch();

    const readAloud = useCallback((message: string) => {
        dispatch(setReadout(message));
    }, [dispatch]);

    return readAloud;
};
