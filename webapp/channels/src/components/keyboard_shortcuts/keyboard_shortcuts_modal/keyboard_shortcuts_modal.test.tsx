// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import * as redux from 'react-redux';

import KeyboardShortcutsModal from 'components/keyboard_shortcuts/keyboard_shortcuts_modal/keyboard_shortcuts_modal';

import mockStore from 'tests/test_store';
import {suitePluginIds} from 'utils/constants';

describe('components/KeyboardShortcutsModal', () => {
    const initialState = {
        plugins: {
            plugins: {},
        },
    };

    test('should match snapshot modal', async () => {
        const store = await mockStore(initialState);
        jest.spyOn(redux, 'useSelector').mockImplementation((cb) => cb(store.getState()));

        const wrapper = shallow(
            <KeyboardShortcutsModal onExited={jest.fn()}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot modal with Calls enabled', async () => {
        const store = await mockStore({
            ...initialState,
            plugins: {
                ...initialState.plugins,
                plugins: {
                    ...initialState.plugins.plugins,
                    [suitePluginIds.calls]: {
                        id: suitePluginIds.calls,
                        version: '0.15.0',
                    },
                },
            },
        });

        jest.spyOn(redux, 'useSelector').mockImplementation((cb) => cb(store.getState()));

        const wrapper = shallow(
            <KeyboardShortcutsModal onExited={jest.fn()}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
