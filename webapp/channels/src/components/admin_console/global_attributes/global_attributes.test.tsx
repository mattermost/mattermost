// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import GlobalAttributes from './global_attributes';

describe('components/admin_console/global_attributes/GlobalAttributes', () => {
    test('renders the empty shell header and placeholder text', () => {
        renderWithContext(<GlobalAttributes/>);

        expect(screen.getByText('Manage Attributes')).toBeInTheDocument();
        expect(screen.getByText('Global attributes will be here.')).toBeInTheDocument();
    });
});
