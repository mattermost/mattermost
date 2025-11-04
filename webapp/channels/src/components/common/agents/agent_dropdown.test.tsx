// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Agent} from '@mattermost/types/agents';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AgentDropdown from './agent_dropdown';

describe('AgentDropdown', () => {
    const mockBots: Agent[] = [
        {
            id: 'bot1',
            displayName: 'Copilot',
            username: 'copilot',
            service_id: 'service1',
            service_type: 'copilot',
        },
        {
            id: 'bot2',
            displayName: 'OpenAI',
            username: 'openai',
            service_id: 'service2',
            service_type: 'openai',
        },
        {
            id: 'bot3',
            displayName: 'Azure OpenAI',
            username: 'azureopenai',
            service_id: 'service3',
            service_type: 'azure',
        },
    ];

    const defaultProps = {
        selectedBotId: 'bot1',
        onBotSelect: jest.fn(),
        bots: mockBots,
        defaultBotId: 'bot1',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render with selected bot name', () => {
        renderWithContext(<AgentDropdown {...defaultProps}/>);

        expect(screen.getByText('Copilot')).toBeInTheDocument();
    });

    test('should show label when showLabel is true', () => {
        renderWithContext(
            <AgentDropdown
                {...defaultProps}
                showLabel={true}
            />,
        );

        expect(screen.getByText('GENERATE WITH:')).toBeInTheDocument();
        expect(screen.getByText('Copilot')).toBeInTheDocument();
    });

    test('should not show label by default', () => {
        renderWithContext(<AgentDropdown {...defaultProps}/>);

        expect(screen.queryByText('GENERATE WITH:')).not.toBeInTheDocument();
    });

    test('should render placeholder when no bot is selected', () => {
        renderWithContext(
            <AgentDropdown
                {...defaultProps}
                selectedBotId={null}
            />,
        );

        expect(screen.getByText('Select a bot')).toBeInTheDocument();
    });

    test('should open menu when button is clicked', async () => {
        renderWithContext(<AgentDropdown {...defaultProps}/>);

        const button = screen.getByLabelText('Agent selector');
        await userEvent.click(button);

        expect(screen.getByText('CHOOSE A BOT')).toBeInTheDocument();
        expect(screen.getByText('Copilot (default)')).toBeInTheDocument();
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
        expect(screen.getByText('Azure OpenAI')).toBeInTheDocument();
    });

    test('should display default label for default bot', async () => {
        renderWithContext(<AgentDropdown {...defaultProps}/>);

        const button = screen.getByLabelText('Agent selector');
        await userEvent.click(button);

        expect(screen.getByText('Copilot (default)')).toBeInTheDocument();
    });

    test('should not display default label for non-default bots', async () => {
        renderWithContext(<AgentDropdown {...defaultProps}/>);

        const button = screen.getByLabelText('Agent selector');
        await userEvent.click(button);

        expect(screen.getByText('OpenAI')).toBeInTheDocument();
        expect(screen.queryByText('OpenAI (default)')).not.toBeInTheDocument();
    });

    test('should call onBotSelect when a bot is clicked', async () => {
        const onBotSelect = jest.fn();
        renderWithContext(
            <AgentDropdown
                {...defaultProps}
                onBotSelect={onBotSelect}
            />,
        );

        const button = screen.getByLabelText('Agent selector');
        await userEvent.click(button);

        const openAIOption = screen.getByTestId('agent-option-bot2');
        await userEvent.click(openAIOption);

        // Wait for callback to be called after menu closes
        await waitFor(() => expect(onBotSelect).toHaveBeenCalledTimes(1));
        expect(onBotSelect).toHaveBeenCalledWith('bot2');
    });

    test('should show checkmark for selected bot', async () => {
        renderWithContext(
            <AgentDropdown
                {...defaultProps}
                selectedBotId='bot2'
            />,
        );

        const button = screen.getByLabelText('Agent selector');
        await userEvent.click(button);

        const selectedOption = screen.getByTestId('agent-option-bot2');
        const checkIcon = selectedOption.querySelector('svg');
        expect(checkIcon).toBeInTheDocument();
    });

    test('should not show checkmark for non-selected bots', async () => {
        renderWithContext(
            <AgentDropdown
                {...defaultProps}
                selectedBotId='bot1'
            />,
        );

        const button = screen.getByLabelText('Agent selector');
        await userEvent.click(button);

        const nonSelectedOption = screen.getByTestId('agent-option-bot2');
        const trailingElements = nonSelectedOption.querySelector('.trailing-elements');
        expect(trailingElements).not.toBeInTheDocument();
    });

    test('should be disabled when disabled prop is true', () => {
        renderWithContext(
            <AgentDropdown
                {...defaultProps}
                disabled={true}
            />,
        );

        const button = screen.getByLabelText('Agent selector');
        expect(button).toBeDisabled();
    });

    test('should render all bots in the list', async () => {
        renderWithContext(<AgentDropdown {...defaultProps}/>);

        const button = screen.getByLabelText('Agent selector');
        await userEvent.click(button);

        mockBots.forEach((bot) => {
            const isDefault = bot.id === defaultProps.defaultBotId;
            const expectedText = isDefault ? `${bot.displayName} (default)` : bot.displayName;
            expect(screen.getByText(expectedText)).toBeInTheDocument();
        });
    });

    test('should handle keyboard navigation', async () => {
        renderWithContext(<AgentDropdown {...defaultProps}/>);

        // Tab to the button
        await userEvent.tab();

        const button = screen.getByLabelText('Agent selector');
        expect(button).toHaveFocus();

        // Open menu with Enter key
        await userEvent.keyboard('{enter}');

        expect(screen.getByText('CHOOSE A BOT')).toBeInTheDocument();
    });

    test('should update displayed name when selectedBotId changes', () => {
        const {rerender} = renderWithContext(
            <AgentDropdown
                {...defaultProps}
                selectedBotId='bot1'
            />,
        );

        expect(screen.getByText('Copilot')).toBeInTheDocument();

        rerender(
            <AgentDropdown
                {...defaultProps}
                selectedBotId='bot2'
            />,
        );

        expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    test('should render with no default bot', async () => {
        renderWithContext(
            <AgentDropdown
                {...defaultProps}
                defaultBotId={undefined}
            />,
        );

        const button = screen.getByLabelText('Agent selector');
        await userEvent.click(button);

        // All bots should be rendered without "(default)" label
        const copilotOption = screen.getByTestId('agent-option-bot1');
        expect(copilotOption).toHaveTextContent('Copilot');
        expect(screen.queryByText('Copilot (default)')).not.toBeInTheDocument();
    });

    test('should handle empty bots array', () => {
        renderWithContext(
            <AgentDropdown
                {...defaultProps}
                bots={[]}
                selectedBotId={null}
                showLabel={true}
            />,
        );

        expect(screen.getByText('GENERATE WITH:')).toBeInTheDocument();
        expect(screen.getByText('Select a bot')).toBeInTheDocument();
    });
});

