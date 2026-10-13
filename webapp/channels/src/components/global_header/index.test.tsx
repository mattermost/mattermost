// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import GlobalHeader from './index';

jest.mock('utils/products', () => ({
    useCurrentProductId: jest.fn(),
    useCurrentProduct: jest.fn(),
    isChannels: jest.fn(),
    useProducts: jest.fn(),
}));

// The controls are mocked so these tests stay focused on the header shell.
jest.mock('./left_controls/left_controls', () => ({productId}: {productId?: string | null}) => (
    <div id='mock-left-controls'>{productId}</div>
));
jest.mock('./center_controls/center_controls', () => ({productId}: {productId?: string | null}) => (
    <div id='mock-center-controls'>{productId}</div>
));
jest.mock('./right_controls/right_controls', () => ({productId}: {productId?: string | null}) => (
    <div id='mock-right-controls'>{productId}</div>
));

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

    const user = TestHelper.getUserMock();

    const loggedInState = {
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

    beforeEach(() => {
        jest.spyOn(productUtils, 'useCurrentProductId').mockReturnValue(null);
        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue(null);
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

        expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    });

    test('should not render in mobile view', () => {
        const state = {
            ...loggedInState,
            views: {
                browser: {
                    windowSize: 'mobileView',
                },
            },
        };

        renderWithContext(<GlobalHeader/>, state);

        expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    });

    test('should render as a banner landmark when user is logged in and not in mobile view', () => {
        renderWithContext(<GlobalHeader/>, loggedInState);

        expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    test('should pass the current product id to each of the controls', () => {
        jest.spyOn(productUtils, 'useCurrentProductId').mockReturnValue('product_id');

        renderWithContext(<GlobalHeader/>, loggedInState);

        expect(screen.getByRole('banner')).toBeInTheDocument();
        expect(screen.getAllByText('product_id')).toHaveLength(3);
    });
});
