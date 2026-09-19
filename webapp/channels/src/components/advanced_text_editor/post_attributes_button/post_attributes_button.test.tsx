// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PostAttributesButton from './post_attributes_button';

describe('PostAttributesButton', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
        fetchSpy = jest.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders a plus button labelled for the composer', () => {
        renderWithContext(<PostAttributesButton/>);

        const button = screen.getByRole('button', {name: 'Add attributes'});

        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('id', 'postAttributesButton');
    });
});
