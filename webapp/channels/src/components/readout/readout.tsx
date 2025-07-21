// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {ActionTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

const Readout = (): JSX.Element => {
    const dispatch = useDispatch();
    const {message} = useSelector((state: GlobalState) => state.views.readout);

    useEffect(() => {
        if (message) {
            // Clear the message after 2 seconds
            const timeout = setTimeout(() => {
                dispatch({
                    type: ActionTypes.CLEAR_READOUT,
                });
            }, 2000);

            return () => {
                clearTimeout(timeout);
            };
        }
        return undefined;
    }, [message, dispatch]);

    return (
        <div
            className='sr-only'
            role='status'
            aria-live='polite'
            aria-atomic='true'
        >
            {message}
        </div>
    );
};

export default Readout;
