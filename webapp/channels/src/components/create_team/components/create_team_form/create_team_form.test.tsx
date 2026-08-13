// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import CreateTeamForm from 'components/create_team/components/create_team_form/create_team_form';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import Constants, {LicenseSkus} from 'utils/constants';

jest.mock('images/logo.png', () => 'logo.png');

const defaultState = {
    entities: {
        general: {
            config: {
                UseAnonymousURLs: 'false',
            },
        },
    },
};

describe('CreateTeamForm - display_name step', () => {
    let defaultProps: {
        step: 'display_name';
        updateParent: jest.Mock;
        state: {team: {name: string; display_name: string}; wizard: string};
        actions: {checkIfTeamExists: jest.Mock; createTeam: jest.Mock};
        history: {push: jest.Mock};
    };

    beforeEach(() => {
        jest.clearAllMocks();
        defaultProps = {
            step: 'display_name' as const,
            updateParent: jest.fn(),
            state: {
                team: {name: 'test-team', display_name: 'test-team'},
                wizard: 'display_name',
            },
            actions: {
                checkIfTeamExists: jest.fn().mockResolvedValue({data: false}),
                createTeam: jest.fn().mockResolvedValue({data: {name: 'test-team'}}),
            },
            history: {push: jest.fn()},
        };
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<CreateTeamForm {...defaultProps}/>, defaultState);
        expect(container).toMatchSnapshot();
    });

    test('should run updateParent function on next', async () => {
        renderWithContext(<CreateTeamForm {...defaultProps}/>, defaultState);

        await userEvent.click(screen.getByRole('button', {name: /next/i}));

        expect(defaultProps.updateParent).toHaveBeenCalled();
    });

    test('should pass state to updateParent function', async () => {
        renderWithContext(<CreateTeamForm {...defaultProps}/>, defaultState);

        await userEvent.click(screen.getByRole('button', {name: /next/i}));

        expect(defaultProps.updateParent).toHaveBeenCalledWith(expect.objectContaining({
            wizard: 'team_url',
            team: expect.objectContaining({
                display_name: 'test-team',
            }),
        }));
    });

    test('should pass updated team name to updateParent function', async () => {
        renderWithContext(<CreateTeamForm {...defaultProps}/>, defaultState);
        const teamDisplayName = 'My Test Team';

        const input = screen.getByRole('textbox');
        await userEvent.clear(input);
        await userEvent.type(input, teamDisplayName);

        await userEvent.click(screen.getByRole('button', {name: /next/i}));

        expect(defaultProps.updateParent).toHaveBeenCalledWith(expect.objectContaining({
            wizard: 'team_url',
            team: expect.objectContaining({
                display_name: teamDisplayName,
            }),
        }));
    });

    describe('with UseAnonymousURLs enabled', () => {
        const anonymousURLState = {
            entities: {
                general: {
                    config: {
                        UseAnonymousURLs: 'true',
                    },
                    license: {SkuShortName: LicenseSkus.EnterpriseAdvanced},
                },
            },
        };

        test('should show Create button instead of Next', () => {
            renderWithContext(<CreateTeamForm {...defaultProps}/>, anonymousURLState);

            expect(screen.getByRole('button', {name: /create/i})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /next/i})).not.toBeInTheDocument();
        });

        test('should create team directly without going to team_url step', async () => {
            renderWithContext(<CreateTeamForm {...defaultProps}/>, anonymousURLState);

            await userEvent.click(screen.getByRole('button', {name: /create/i}));

            await waitFor(() => {
                expect(defaultProps.actions.createTeam).toHaveBeenCalledTimes(1);
                expect(defaultProps.actions.createTeam).toHaveBeenCalledWith(expect.objectContaining({
                    display_name: 'test-team',
                    type: 'O',
                }));
            });

            expect(defaultProps.updateParent).not.toHaveBeenCalled();
        });

        test('should navigate to team default channel on successful creation', async () => {
            const actions = {
                ...defaultProps.actions,
                createTeam: jest.fn().mockResolvedValue({data: {name: 'my-new-team'}}),
            };

            renderWithContext(
                <CreateTeamForm
                    {...defaultProps}
                    actions={actions}
                />,
                anonymousURLState,
            );

            await userEvent.click(screen.getByRole('button', {name: /create/i}));

            await waitFor(() => {
                expect(defaultProps.history.push).toHaveBeenCalledWith('/my-new-team/channels/town-square');
            });
        });

        test('should display error when team creation fails', async () => {
            const actions = {
                ...defaultProps.actions,
                createTeam: jest.fn().mockResolvedValue({error: {message: 'Team creation failed'}}),
            };

            renderWithContext(
                <CreateTeamForm
                    {...defaultProps}
                    actions={actions}
                />,
                anonymousURLState,
            );

            await userEvent.click(screen.getByRole('button', {name: /create/i}));

            await waitFor(() => {
                expect(screen.getByText('Team creation failed')).toBeInTheDocument();
            });

            expect(defaultProps.history.push).not.toHaveBeenCalled();
        });

        test('should show loading state while creating team', async () => {
            let resolveCreateTeam: (value: {data: {name: string}}) => void;
            const createTeamPromise = new Promise<{data: {name: string}}>((resolve) => {
                resolveCreateTeam = resolve;
            });

            const actions = {
                ...defaultProps.actions,
                createTeam: jest.fn().mockReturnValue(createTeamPromise),
            };

            renderWithContext(
                <CreateTeamForm
                    {...defaultProps}
                    actions={actions}
                />,
                anonymousURLState,
            );

            await userEvent.click(screen.getByRole('button', {name: /create/i}));

            await waitFor(() => {
                expect(screen.getByText('Creating team...')).toBeInTheDocument();
            });

            resolveCreateTeam!({data: {name: 'my-new-team'}});

            await waitFor(() => {
                expect(defaultProps.history.push).toHaveBeenCalled();
            });
        });

        test('should not create team when display name is too short', async () => {
            const props = {
                ...defaultProps,
                state: {
                    team: {name: '', display_name: ''},
                    wizard: 'display_name',
                },
            };

            renderWithContext(<CreateTeamForm {...props}/>, anonymousURLState);

            await userEvent.click(screen.getByRole('button', {name: /create/i}));

            expect(defaultProps.actions.createTeam).not.toHaveBeenCalled();
            expect(defaultProps.updateParent).not.toHaveBeenCalled();
        });
    });
});

describe('CreateTeamForm - team_url step', () => {
    const defaultProps = {
        step: 'team_url' as const,
        updateParent: jest.fn(),
        state: {
            team: {name: 'test-team', display_name: 'test-team'},
            wizard: 'team_url',
        },
        actions: {
            checkIfTeamExists: jest.fn().mockResolvedValue({data: true}),
            createTeam: jest.fn().mockResolvedValue({data: {name: 'test-team'}}),
        },
        history: {push: jest.fn()},
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<CreateTeamForm {...defaultProps}/>, defaultState);
        expect(container).toMatchSnapshot();
    });

    test('should return to display_name page', async () => {
        renderWithContext(<CreateTeamForm {...defaultProps}/>, defaultState);

        await userEvent.click(screen.getByText('Back to previous step'));

        expect(defaultProps.updateParent).toHaveBeenCalledWith({
            ...defaultProps.state,
            wizard: 'display_name',
        });
    });

    test('should show Finish button on the team_url step', () => {
        renderWithContext(<CreateTeamForm {...defaultProps}/>, defaultState);

        expect(screen.getByRole('button', {name: /finish/i})).toBeInTheDocument();
    });

    test('should successfully submit', async () => {
        const checkIfTeamExists = jest.fn().
            mockResolvedValueOnce({data: true}).
            mockResolvedValue({data: false});

        const actions = {...defaultProps.actions, checkIfTeamExists};
        const props = {...defaultProps, actions};

        renderWithContext(
            <CreateTeamForm {...props}/>,
            defaultState,
        );

        await userEvent.click(screen.getByText('Finish'));

        await waitFor(() => {
            expect(screen.getByText('This URL is taken or unavailable. Please try another.')).toBeInTheDocument();
        });

        expect(actions.checkIfTeamExists).toHaveBeenCalledTimes(1);
        expect(actions.createTeam).not.toHaveBeenCalled();

        await userEvent.click(screen.getByText('Finish'));

        await waitFor(() => {
            expect(actions.checkIfTeamExists).toHaveBeenCalledTimes(2);
            expect(actions.createTeam).toHaveBeenCalledTimes(1);
            expect(actions.createTeam).toHaveBeenCalledWith({display_name: 'test-team', name: 'test-team', type: 'O'});
            expect(props.history.push).toHaveBeenCalledTimes(1);
            expect(props.history.push).toHaveBeenCalledWith('/test-team/channels/town-square');
        });
    });

    test('should display isRequired error', async () => {
        renderWithContext(
            <CreateTeamForm {...defaultProps}/>,
            defaultState,
        );

        await userEvent.clear(screen.getByRole('textbox'));
        await userEvent.click(screen.getByText('Finish'));

        expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    test('should display charLength error', async () => {
        const checkIfTeamExists = jest.fn().
            mockResolvedValue({data: false});

        const actions = {...defaultProps.actions, checkIfTeamExists};
        const props = {...defaultProps, actions};

        const lengthError = `Name must be ${Constants.MIN_TEAMNAME_LENGTH} or more characters up to a maximum of ${Constants.MAX_TEAMNAME_LENGTH}`;

        renderWithContext(
            <CreateTeamForm {...props}/>,
            defaultState,
        );

        await userEvent.clear(screen.getByRole('textbox'));

        expect(screen.queryByText(lengthError)).not.toBeInTheDocument();

        await userEvent.type(screen.getByRole('textbox'), 'a');
        await userEvent.click(screen.getByText('Finish'));

        expect(screen.getByText(lengthError)).toBeInTheDocument();

        await userEvent.clear(screen.getByRole('textbox'));
        await userEvent.type(screen.getByRole('textbox'), 'a'.repeat(Constants.MAX_TEAMNAME_LENGTH + 1));
        await userEvent.click(screen.getByText('Finish'));

        expect(screen.getByText(lengthError)).toBeInTheDocument();
    });

    test('should display teamUrl regex error', async () => {
        renderWithContext(
            <CreateTeamForm {...defaultProps}/>,
            defaultState,
        );

        await userEvent.type(screen.getByRole('textbox'), '!!wrongName1');
        await userEvent.click(screen.getByText('Finish'));

        expect(screen.getByText("Use only lower case letters, numbers and dashes. Must start with a letter and can't end in a dash.")).toBeInTheDocument();
    });

    test('should display teamUrl taken error', async () => {
        renderWithContext(
            <CreateTeamForm {...defaultProps}/>,
            defaultState,
        );

        await userEvent.type(screen.getByRole('textbox'), 'channel');
        await userEvent.click(screen.getByText('Finish'));

        expect(screen.getByText('Please try another.', {exact: false})).toBeInTheDocument();
    });

    test('should focus input when validation error occurs', async () => {
        renderWithContext(
            <CreateTeamForm {...defaultProps}/>,
            defaultState,
        );

        const input = screen.getByRole('textbox');
        await userEvent.clear(input);
        const focusSpy = jest.spyOn(input, 'focus');

        // Trigger validation error by submitting empty input
        await userEvent.click(screen.getByText('Finish'));

        expect(focusSpy).toHaveBeenCalled();
    });
});
