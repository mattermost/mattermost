// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {setStatusDropdown} from 'actions/views/status_dropdown';
import {isStatusDropdownOpen} from 'selectors/views/status_dropdown';
import configureStore from 'store';

describe('status_dropdown view actions', () => {
    const initialState = {
        views: {
            statusDropdown: {
                isOpen: false,
            },
        },
    };

    it('setStatusDropdown should set the status dropdown open or not', () => {
        const store = configureStore(initialState);

        store.dispatch(setStatusDropdown(false));

        expect(isStatusDropdownOpen(store.getState())).toBe(false);

        store.dispatch(setStatusDropdown(true));

        expect(isStatusDropdownOpen(store.getState())).toBe(true);
    });
});
