// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import GlobalAttributes from './global_attributes';

describe('components/admin_console/global_attributes/GlobalAttributes', () => {
    const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields');

    beforeEach(() => {
        getPropertyFields.mockReset();
        getPropertyFields.mockResolvedValue([]);
    });

    test('renders the header and section frame, and renders the attributes table', async () => {
        renderWithContext(<GlobalAttributes/>);

        expect(screen.getByText('Manage Attributes')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Attributes'})).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByTestId('global-attributes-empty')).toBeInTheDocument();
        });
    });
});
