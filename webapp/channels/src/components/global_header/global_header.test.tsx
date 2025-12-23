// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import GlobalHeader from './global_header';

jest.mock('utils/products', () => ({
    useCurrentProductId: jest.fn(),
    isChannels: jest.fn(),
    useProducts: jest.fn(),
}));

describe('components/global/GlobalHeader', () => {
    const initialState = {
        entities: {
            general: {
                config: {},
                license: {
                    IsLicensed: 'false',
                },
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    beforeEach(() => {
        jest.spyOn(productUtils, 'useCurrentProductId').mockReturnValue(null);
        jest.spyOn(productUtils, 'isChannels').mockReturnValue(true);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should not render when user is not logged in', () => {
        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    currentUserId: '',
                },
            },
        };

        renderWithContext(<GlobalHeader/>, state);

        expect(screen.queryByTestId('global-header')).not.toBeInTheDocument();
    });

    test('should not render in mobile view', () => {
        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    currentUserId: 'user1',
                },
            },
            views: {
                browser: {
                    windowSize: 'mobileView',
                },
            },
        };

        renderWithContext(<GlobalHeader/>, state);

        expect(screen.queryByTestId('global-header')).not.toBeInTheDocument();
    });

    test('should render when user is logged in and not in mobile view', () => {
        const user = TestHelper.getUserMock();

        const state = {
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    currentUserId: user.id,
                    profiles: {
                        [user.id]: user,
                    },
                },
            },
        };

        renderWithContext(<GlobalHeader/>, state);

        expect(screen.queryByText('TEAM EDITION')).toBeInTheDocument();
    });
});
