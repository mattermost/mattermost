// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import {renderWithContext} from 'tests/react_testing_utils';

import DataSpillageAction from './data_spillage_actions';

describe('DataSpillageAction', () => {
    test('should render both action buttons', () => {
        renderWithContext(<DataSpillageAction />);

        expect(screen.getByTestId('data-spillage-action')).toBeInTheDocument();
        expect(screen.getByTestId('data-spillage-action-remove-message')).toBeInTheDocument();
        expect(screen.getByTestId('data-spillage-action-keep-message')).toBeInTheDocument();
    });

    test('should render remove message button with correct text', () => {
        renderWithContext(<DataSpillageAction />);

        const removeButton = screen.getByTestId('data-spillage-action-remove-message');
        expect(removeButton).toHaveTextContent('Remove message');
        expect(removeButton).toHaveClass('btn btn-danger btn-sm');
    });

    test('should render keep message button with correct text', () => {
        renderWithContext(<DataSpillageAction />);

        const keepButton = screen.getByTestId('data-spillage-action-keep-message');
        expect(keepButton).toHaveTextContent('Kepp message');
        expect(keepButton).toHaveClass('btn btn-tertiary btn-sm');
    });
});
