// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UnknownAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

// Allows useDispatch to take Thunk actions
declare module 'react-redux' {
    function useDispatch<A extends Action = UnknownAction, State = any>(): ThunkDispatch<State, unknown, A>;
}
