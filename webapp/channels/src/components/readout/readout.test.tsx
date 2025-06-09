// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, act} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import {ActionTypes} from 'utils/constants';

import Readout from './readout';

describe('Readout', () => {
    const mockStore = configureStore([]);

    it('should render message and clear it after timeout', async () => {
        jest.useFakeTimers();

        const store = mockStore({
            views: {
                readout: {
                    message: 'Test message',
                },
            },
        });

        render(
            <Provider store={store}>
                <Readout/>
            </Provider>,
        );

        // Message should be visible
        expect(screen.getByText('Test message')).toBeInTheDocument();

        // Fast-forward 2 seconds
        act(() => {
            jest.advanceTimersByTime(2000);
        });

        // Message should be cleared
        expect(store.getActions()).toEqual([
            {
                type: ActionTypes.CLEAR_READOUT,
            },
        ]);

        jest.useRealTimers();
    });
});
