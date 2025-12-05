// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {cleanUpUrlable} from 'utils/url';

import DisplayName from './display_name';

vi.mock('images/logo.png', () => ({default: 'logo.png'}));

describe('/components/create_team/components/display_name', () => {
    const defaultProps = {
        updateParent: vi.fn(),
        state: {
            team: {name: 'test-team', display_name: 'test-team'},
            wizard: 'display_name',
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<DisplayName {...defaultProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should run updateParent function', () => {
        const updateParent = vi.fn();
        const props = {...defaultProps, updateParent};

        renderWithContext(<DisplayName {...props}/>);

        fireEvent.click(screen.getByRole('button'));

        expect(updateParent).toHaveBeenCalled();
    });

    test('should pass state to updateParent function', () => {
        const updateParent = vi.fn();
        const props = {...defaultProps, updateParent};

        renderWithContext(<DisplayName {...props}/>);

        fireEvent.click(screen.getByRole('button'));

        expect(updateParent).toHaveBeenCalledWith(defaultProps.state);
    });

    test('should pass updated team name to updateParent function', () => {
        const updateParent = vi.fn();
        const props = {...defaultProps, updateParent};
        const teamDisplayName = 'My Test Team';
        const expectedState = {
            ...defaultProps.state,
            team: {
                ...defaultProps.state.team,
                display_name: teamDisplayName,
                name: cleanUpUrlable(teamDisplayName),
            },
        };

        renderWithContext(<DisplayName {...props}/>);

        const input = screen.getByRole('textbox');
        fireEvent.change(input, {target: {value: teamDisplayName}});
        fireEvent.click(screen.getByRole('button'));

        expect(updateParent).toHaveBeenCalledWith(expectedState);
    });
});
