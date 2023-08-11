// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {setStatusDropdown} from 'actions/views/status_dropdown';
import {isStatusDropdownOpen} from 'selectors/views/status_dropdown';
import configureStore from 'store';

describe('status_dropdown selector', () => {
    it('should return the isOpen value from the state', async () => {
        const store = await configureStore();
        expect(isStatusDropdownOpen(store.getState())).toBeFalsy();
    });

    it('should return true if statusDropdown in explicitly opened', async () => {
        const store = await configureStore();
        await store.dispatch(setStatusDropdown(true));
        expect(isStatusDropdownOpen(store.getState())).toBeTruthy();
    });
});
