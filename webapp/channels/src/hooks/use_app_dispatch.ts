// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useContext, useMemo} from 'react';
import {useStore} from 'react-redux';
import type {Dispatch, AnyAction} from 'redux';

import type {ThunkActionFunc} from 'mattermost-redux/types/actions';

import {AppContext} from 'utils/app_context';

export default function useAppDispatch() {
    const store = useStore();
    const appContext = useContext(AppContext);

    return useMemo<Dispatch>(() => {
        const appDispatch: Dispatch = (action: AnyAction | ThunkActionFunc<any>) => {
            let result;

            if (typeof action === 'function') {
                result = action(appDispatch, store.getState, {context: appContext});
            } else {
                result = store.dispatch(action);
            }

            return result;
        };

        return appDispatch;
    }, [store, appContext]);
}
