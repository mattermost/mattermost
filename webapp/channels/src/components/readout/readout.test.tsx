// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, act} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import Readout from './readout';

describe('Readout', () => {
    it('should render message and clear it after timeout', async () => {
        jest.useFakeTimers();

        renderWithContext(<Readout/>, {
            views: {
                readout: {
                    message: 'Test message',
                },
            },
        });

        // Message should be visible
        expect(screen.getByText('Test message')).toBeInTheDocument();

        // Fast-forward 2 seconds
        act(() => {
            jest.advanceTimersByTime(2000);
        });

        // Message should be cleared
        expect(screen.queryByText('Test message')).not.toBeInTheDocument();

        jest.useRealTimers();
    });
});
