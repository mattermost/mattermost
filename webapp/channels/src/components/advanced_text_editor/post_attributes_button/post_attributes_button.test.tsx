// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PostAttributesButton from './post_attributes_button';

describe('PostAttributesButton', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders a plus button labelled for the composer', () => {
        renderWithContext(<PostAttributesButton/>);

        const button = screen.getByRole('button', {name: 'Add attributes'});

        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('id', 'postAttributesButton');
    });

    test('looks disabled but stays focusable and shows its tooltip', async () => {
        renderWithContext(<PostAttributesButton/>);

        const button = screen.getByRole('button', {name: 'Add attributes'});

        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).not.toHaveAttribute('disabled');
        expect(button.className).toMatch(/icon-button--disabled/);

        await userEvent.tab();

        await waitFor(() => {
            expect(button).toHaveFocus();
            expect(screen.getByText('Add attributes')).toBeInTheDocument();
        });
    });
});
