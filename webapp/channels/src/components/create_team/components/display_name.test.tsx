// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import DisplayName from 'components/create_team/components/display_name';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {cleanUpUrlable} from 'utils/url';

jest.mock('images/logo.png', () => 'logo.png');

describe('/components/create_team/components/display_name', () => {
    const defaultProps = {
        updateParent: jest.fn(),
        state: {
            team: {name: 'test-team', display_name: 'test-team'},
            wizard: 'display_name',
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<DisplayName {...defaultProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should run updateParent function', () => {
        renderWithContext(<DisplayName {...defaultProps}/>);

        fireEvent.click(screen.getByRole('button', {name: /next/i}));

        expect(defaultProps.updateParent).toHaveBeenCalled();
    });

    test('should pass state to updateParent function', () => {
        renderWithContext(<DisplayName {...defaultProps}/>);

        fireEvent.click(screen.getByRole('button', {name: /next/i}));

        expect(defaultProps.updateParent).toHaveBeenCalledWith(expect.objectContaining({
            wizard: 'team_url',
            team: expect.objectContaining({
                display_name: 'test-team',
            }),
        }));
    });

    test('should pass updated team name to updateParent function', () => {
        renderWithContext(<DisplayName {...defaultProps}/>);
        const teamDisplayName = 'My Test Team';
        const expectedTeam = {
            ...defaultProps.state.team,
            display_name: teamDisplayName,
            name: cleanUpUrlable(teamDisplayName),
        };

        const input = screen.getByRole('textbox');
        fireEvent.change(input, {target: {value: teamDisplayName}});

        fireEvent.click(screen.getByRole('button', {name: /next/i}));

        expect(defaultProps.updateParent).toHaveBeenCalledWith(expect.objectContaining({
            wizard: 'team_url',
            team: expectedTeam,
        }));
    });
});
