// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getAgents} from 'mattermost-redux/actions/agents';

import {renderWithContext, screen, userEvent, waitFor, waitForElementToBeRemoved} from 'tests/react_testing_utils';

import CreateRecapModal from './create_recap_modal';

jest.mock('mattermost-redux/actions/recaps', () => ({
    createRecap: jest.fn(() => ({type: 'CREATE_RECAP'})),
}));

jest.mock('mattermost-redux/actions/agents', () => ({
    getAgents: jest.fn(() => ({type: 'GET_AGENTS'})),
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({
        push: jest.fn(),
    }),
    useRouteMatch: () => ({
        url: '/team/test',
    }),
}));

describe('CreateRecapModal', () => {
    const defaultProps = {
        onExited: jest.fn(),
    };

    const mockAgents = [
        {
            id: 'copilot-bot',
            displayName: 'Copilot',
            username: 'copilot',
            service_id: 'copilot-service',
            service_type: 'copilot',
        },
        {
            id: 'openai-bot',
            displayName: 'OpenAI',
            username: 'openai',
            service_id: 'openai-service',
            service_type: 'openai',
        },
        {
            id: 'azure-bot',
            displayName: 'Azure OpenAI',
            username: 'azureopenai',
            service_id: 'azure-service',
            service_type: 'azure',
        },
    ];

    const initialState = {
        entities: {
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: {id: 'user1', username: 'testuser'},
                },
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {id: 'team1', name: 'test-team', display_name: 'Test Team'},
                },
                myMembers: {
                    team1: {team_id: 'team1', user_id: 'user1'},
                },
            },
            channels: {
                channels: {
                    channel1: {id: 'channel1', name: 'test-channel', display_name: 'Test Channel', team_id: 'team1'},
                    channel2: {id: 'channel2', name: 'another-channel', display_name: 'Another Channel', team_id: 'team1'},
                },
                channelsInTeam: {
                    team1: new Set(['channel1', 'channel2']),
                },
                myMembers: {
                    channel1: {channel_id: 'channel1', msg_count: 5, mention_count: 0},
                    channel2: {channel_id: 'channel2', msg_count: 3, mention_count: 0},
                },
                messageCounts: {
                    channel1: {total: 10, root: 10},
                    channel2: {total: 5, root: 5},
                },
            },
            agents: {
                agents: mockAgents,
            },
            preferences: {
                myPreferences: {},
            },
            general: {
                config: {},
            },
        },
        views: {
            channel: {
                postVisibility: {},
                lastChannelViewTime: {},
                loadingPosts: {},
                focusedPostId: '',
                mobileView: false,
                lastUnreadChannel: null,
                lastGetPosts: {},
                channelPrefetchStatus: {},
                toastStatus: false,
            },
        },
    };

    test('should render modal with header including AI agent dropdown', () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        expect(screen.getByText('Set up your recap')).toBeInTheDocument();
        expect(screen.getByText('GENERATE WITH:')).toBeInTheDocument();
        expect(screen.getByText('Copilot')).toBeInTheDocument();
    });

    test('should fetch AI agents on mount', () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        expect(getAgents).toHaveBeenCalledTimes(1);
    });

    test('should show AI agent dropdown with default bot selected and label', () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        // The default bot (Copilot) should be displayed
        expect(screen.getByText('Copilot')).toBeInTheDocument();

        // Label should be shown
        expect(screen.getByText('GENERATE WITH:')).toBeInTheDocument();
    });

    test('should open AI agent dropdown and show bot options', async () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        const dropdownButton = screen.getByLabelText('Agent selector');
        await userEvent.click(dropdownButton);

        expect(screen.getByText('CHOOSE A BOT')).toBeInTheDocument();
        expect(screen.getByText('Copilot (default)')).toBeInTheDocument();
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
        expect(screen.getByText('Azure OpenAI')).toBeInTheDocument();
    });

    test('should change selected bot when clicking on a different bot', async () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        // Wait for initial bot to be selected
        await waitFor(() => {
            const dropdownButton = screen.getByLabelText('Agent selector');
            expect(dropdownButton).toHaveTextContent('Copilot');
        });

        // Open dropdown
        const dropdownButton = screen.getByLabelText('Agent selector');
        await userEvent.click(dropdownButton);

        // Click on OpenAI
        const openAIOption = screen.getByText('OpenAI');
        await userEvent.click(openAIOption);

        // Wait for menu to close
        await waitForElementToBeRemoved(() => screen.queryByText('CHOOSE A BOT'));

        // OpenAI should now be displayed in the button
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    test('should disable AI agent dropdown when submitting', async () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        // Fill in the form to enable submit
        const nameInput = screen.getByPlaceholderText('Give your recap a name');
        await userEvent.type(nameInput, 'Test Recap');

        // Select all unreads option
        const allUnreadsButton = screen.getByText('Recap all my unreads');
        await userEvent.click(allUnreadsButton);

        // Go to next step
        const nextButton = screen.getByRole('button', {name: /next/i});
        await userEvent.click(nextButton);

        // The dropdown button should still be enabled before submission
        const dropdownButton = screen.getByLabelText('Agent selector');
        expect(dropdownButton).not.toBeDisabled();
    });

    test('should render step one initially', () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        expect(screen.getByText('Give your recap a name')).toBeInTheDocument();
        expect(screen.getByText('What type of recap would you like?')).toBeInTheDocument();
    });

    test('should show pagination dots', () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        const paginationDots = document.querySelectorAll('.pagination-dot');
        expect(paginationDots.length).toBeGreaterThan(0);
    });

    test('should show Next button on first step', () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        expect(screen.getByRole('button', {name: /next/i})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /previous/i})).not.toBeInTheDocument();
    });

    test('should disable Next button when form is incomplete', () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        const nextButton = screen.getByRole('button', {name: /next/i});
        expect(nextButton).toBeDisabled();
    });

    test('should enable Next button when form is complete', async () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        // Wait for bot to be selected automatically
        await waitFor(() => {
            const dropdownButton = screen.getByLabelText('Agent selector');
            expect(dropdownButton).toHaveTextContent('Copilot');
        });

        const nameInput = screen.getByPlaceholderText('Give your recap a name');
        await userEvent.type(nameInput, 'Test Recap');

        const allUnreadsButton = screen.getByText('Recap all my unreads');
        await userEvent.click(allUnreadsButton);

        const nextButton = screen.getByRole('button', {name: /next/i});
        await waitFor(() => expect(nextButton).not.toBeDisabled());
    });

    test('should show Previous button on later steps', async () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        // Fill form to enable navigation
        await waitFor(() => {
            const dropdownButton = screen.getByLabelText('Agent selector');
            expect(dropdownButton).toHaveTextContent('Copilot');
        });

        const nameInput = screen.getByPlaceholderText('Give your recap a name');
        await userEvent.type(nameInput, 'Test Recap');

        // Select "Recap selected channels" to go to step 2
        const selectedChannelsButton = screen.getByText('Recap selected channels');
        await userEvent.click(selectedChannelsButton);

        const nextButton = screen.getByRole('button', {name: /next/i});
        await userEvent.click(nextButton);

        // Now we should be on step 2 and see the Previous button
        await waitFor(() => {
            expect(screen.getByRole('button', {name: /previous/i})).toBeInTheDocument();
        });
    });

    test('should maintain selected bot across step navigation', async () => {
        renderWithContext(<CreateRecapModal {...defaultProps}/>, initialState);

        // Wait for initial bot to be selected
        await waitFor(() => {
            const dropdownButton = screen.getByLabelText('Agent selector');
            expect(dropdownButton).toHaveTextContent('Copilot');
        });

        // Change bot to OpenAI
        const dropdownButton = screen.getByLabelText('Agent selector');
        await userEvent.click(dropdownButton);
        const openAIOption = screen.getByText('OpenAI');
        await userEvent.click(openAIOption);

        // Wait for menu to close
        await waitForElementToBeRemoved(() => screen.queryByText('CHOOSE A BOT'));

        // Fill form and go to next step
        const nameInput = screen.getByPlaceholderText('Give your recap a name');
        await userEvent.type(nameInput, 'Test Recap');

        const allUnreadsButton = screen.getByText('Recap all my unreads');
        await userEvent.click(allUnreadsButton);

        const nextButton = screen.getByRole('button', {name: /next/i});
        await userEvent.click(nextButton);

        // OpenAI should still be selected in the header
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });
});

