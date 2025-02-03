// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import TeamUrl from 'components/create_team/components/team_url/team_url';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

jest.mock('images/logo.png', () => 'logo.png');

describe('/components/create_team/components/display_name', () => {
    const defaultProps = {
        updateParent: jest.fn(),
        state: {
            team: {name: 'test-team', display_name: 'test-team'},
            wizard: 'display_name',
        },
        actions: {
            checkIfTeamExists: jest.fn().mockResolvedValue({data: true}),
            createTeam: jest.fn().mockResolvedValue({data: {name: 'test-team'}}),
            trackEvent: jest.fn(),
        },
        history: {push: jest.fn()},
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<TeamUrl {...defaultProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should return to display_name.jsx page', async () => {
        renderWithContext(<TeamUrl {...defaultProps}/>);

        screen.getByText('Back to previous step').click();

        expect(defaultProps.updateParent).toHaveBeenCalledWith({
            ...defaultProps.state,
            wizard: 'display_name',
        });
    });

    test('should successfully submit', async () => {
        const checkIfTeamExists = jest.fn().
            mockResolvedValueOnce({data: true}).
            mockResolvedValue({data: false});

        const actions = {...defaultProps.actions, checkIfTeamExists};
        const props = {...defaultProps, actions};

        renderWithContext(
            <TeamUrl {...props}/>,
        );

        screen.getByText('Finish').click();

        await waitFor(() => {
            expect(screen.getByText('This URL is taken or unavailable. Please try another.')).toBeInTheDocument();
        });

        expect(actions.checkIfTeamExists).toHaveBeenCalledTimes(1);
        expect(actions.createTeam).not.toHaveBeenCalled();

        screen.getByText('Finish').click();

        await waitFor(() => {
            expect(actions.checkIfTeamExists).toHaveBeenCalledTimes(2);
            expect(actions.createTeam).toHaveBeenCalledTimes(1);
            expect(actions.createTeam).toBeCalledWith({display_name: 'test-team', name: 'test-team', type: 'O'});
            expect(props.history.push).toHaveBeenCalledTimes(1);
            expect(props.history.push).toBeCalledWith('/test-team/channels/town-square');
        });
    });

    test('should display isRequired error', () => {
        renderWithContext(
            <TeamUrl {...defaultProps}/>,
        );

        userEvent.clear(screen.getByRole('textbox'));
        screen.getByText('Finish').click();

        expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    test('should display charLength error', () => {
        const lengthError = `Name must be ${Constants.MIN_TEAMNAME_LENGTH} or more characters up to a maximum of ${Constants.MAX_TEAMNAME_LENGTH}`;

        renderWithContext(
            <TeamUrl {...defaultProps}/>,
        );

        expect(screen.queryByText(lengthError)).not.toBeInTheDocument();

        userEvent.type(screen.getByRole('textbox'), 'a');
        screen.getByText('Finish').click();

        expect(screen.getByText(lengthError)).toBeInTheDocument();

        userEvent.type(screen.getByRole('textbox'), 'a'.repeat(Constants.MAX_TEAMNAME_LENGTH + 1));
        screen.getByText('Finish').click();

        expect(screen.getByText(lengthError)).toBeInTheDocument();
    });

    test('should display teamUrl regex error', () => {
        renderWithContext(
            <TeamUrl {...defaultProps}/>,
        );

        userEvent.type(screen.getByRole('textbox'), '!!wrongName1');
        screen.getByText('Finish').click();

        expect(screen.getByText("Use only lower case letters, numbers and dashes. Must start with a letter and can't end in a dash.")).toBeInTheDocument();
    });

    test('should display teamUrl taken error', () => {
        renderWithContext(
            <TeamUrl {...defaultProps}/>,
        );

        userEvent.type(screen.getByRole('textbox'), 'channel');
        screen.getByText('Finish').click();

        expect(screen.getByText('Please try another.', {exact: false})).toBeInTheDocument();
    });
});
