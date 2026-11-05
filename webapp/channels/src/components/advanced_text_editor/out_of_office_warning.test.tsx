// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import OutOfOfficeWarning from './out_of_office_warning';

describe('OutOfOfficeWarning', () => {
    test('should render display name and out of office label', () => {
        renderWithContext(
            <OutOfOfficeWarning displayName='Norma Fletcher'/>,
        );

        expect(screen.getByTestId('outOfOfficeWarning')).toBeInTheDocument();
        expect(screen.getByText('Norma Fletcher is Out of Office.')).toBeInTheDocument();
    });
});
