// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {SwitchProductMenu} from './switch_product_menu';

describe('SwitchProductMenu', () => {
    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {},
                license: TestHelper.getLicenseMock({
                    IsLicensed: 'true',
                    SkuShortName: 'professional',
                }),
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: TestHelper.getUserMock({id: 'user_id'}),
                },
            },
            teams: {
                currentTeamId: 'team_id',
                teams: {
                    team_id: TestHelper.getTeamMock({id: 'team_id'}),
                },
            },
        },
    };

    test('should label the menu button as opening the product menu', () => {
        renderWithContext(<SwitchProductMenu productId={null}/>, initialState);

        expect(screen.getByRole('button', {name: 'Open product menu'})).toBeInTheDocument();
    });

    test('should render the product name inside the menu button so clicking it opens the menu', () => {
        renderWithContext(<SwitchProductMenu productId={null}/>, initialState);

        const menuButton = screen.getByRole('button', {name: 'Open product menu'});

        expect(menuButton).toHaveTextContent('Channels');
    });

    test('should open the menu when the product name is clicked', async () => {
        renderWithContext(<SwitchProductMenu productId={null}/>, initialState);

        expect(screen.queryByRole('menu', {name: 'Product menu'})).not.toBeInTheDocument();

        await userEvent.click(screen.getByText('Channels'));

        expect(screen.getByRole('menu', {name: 'Product menu'})).toBeInTheDocument();
    });
});
