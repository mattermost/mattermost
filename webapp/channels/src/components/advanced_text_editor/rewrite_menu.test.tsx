// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Agent} from '@mattermost/types/agents';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import {RewriteAction} from './rewrite_action';
import type {RewriteMenuProps} from './rewrite_menu';
import RewriteMenu from './rewrite_menu';

jest.mock('components/menu', () => ({
    ...jest.requireActual('components/menu'),
    Container: ({children, menuButton, menuHeader}: any) => (
        <div data-testid='menu-container'>
            <div data-testid='menu-header'>{menuHeader}</div>
            <div data-testid='menu-button'>{menuButton.children}</div>
            <div data-testid='menu-items'>{children}</div>
        </div>
    ),
    Item: ({labels, onClick, leadingElement}: any) => (
        <button
            data-testid='menu-item'
            onClick={onClick}
        >
            {leadingElement}
            {labels}
        </button>
    ),
}));

jest.mock('components/common/agents/agent_dropdown', () => ({
    __esModule: true,
    default: ({selectedBotId, onBotSelect, bots, disabled}: any) => (
        <div data-testid='agent-dropdown'>
            <select
                data-testid='agent-select'
                value={selectedBotId || ''}
                onChange={(e) => onBotSelect(e.target.value)}
                disabled={disabled}
            >
                {bots.map((bot: Agent) => (
                    <option
                        key={bot.id}
                        value={bot.id}
                    >
                        {bot.displayName}
                    </option>
                ))}
            </select>
        </div>
    ),
}));

jest.mock('components/widgets/inputs/input/input', () => {
    const React = require('react');
    const ForwardRefComponent = React.forwardRef(({placeholder, value, onChange, onKeyDown, disabled, inputPrefix}: any, ref: any) => (
        <div data-testid='prompt-input'>
            {inputPrefix}
            <input
                ref={ref}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                disabled={disabled}
                data-testid='prompt-input-field'
            />
        </div>
    ));
    return {
        __esModule: true,
        default: ForwardRefComponent,
    };
});

describe('RewriteMenu', () => {
    const mockAgents: Agent[] = [
        {
            id: 'agent1',
            displayName: 'Agent 1',
            username: 'agent1',
            service_id: 'service1',
            service_type: 'openai',
        },
        {
            id: 'agent2',
            displayName: 'Agent 2',
            username: 'agent2',
            service_id: 'service2',
            service_type: 'anthropic',
        },
    ];

    const baseProps: RewriteMenuProps = {
        isProcessing: false,
        isMenuOpen: false,
        setIsMenuOpen: jest.fn(),
        draftMessage: 'Test message',
        prompt: '',
        setPrompt: jest.fn(),
        selectedAgentId: 'agent1',
        setSelectedAgentId: jest.fn(),
        agents: mockAgents,
        originalMessage: '',
        lastAction: RewriteAction.CUSTOM,
        onMenuAction: jest.fn(() => () => {}),
        onCustomPromptKeyDown: jest.fn(),
        onCancelProcessing: jest.fn(),
        onUndoMessage: jest.fn(),
        onRegenerateMessage: jest.fn(),
        customPromptRef: React.createRef<HTMLInputElement>(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should not render agent dropdown when no agents', () => {
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                agents={[]}
            />,
        );
        expect(screen.queryByTestId('agent-dropdown')).not.toBeInTheDocument();
    });

    test('should render prompt input', () => {
        renderWithContext(<RewriteMenu {...baseProps}/>);
        expect(screen.getByTestId('prompt-input')).toBeInTheDocument();
    });

    test('should render menu items when not processing and draft message exists', () => {
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                draftMessage='Test message'
            />,
        );
        const menuItems = screen.getAllByTestId('menu-item');
        expect(menuItems.length).toBeGreaterThan(0);
    });

    test('should not render menu items when processing', () => {
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                isProcessing={true}
                draftMessage='Test message'
            />,
        );
        expect(screen.queryByTestId('menu-item')).not.toBeInTheDocument();
    });

    test('should not render menu items when draft message is empty', () => {
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                draftMessage=''
            />,
        );
        expect(screen.queryByTestId('menu-item')).not.toBeInTheDocument();
    });

    test('should render cancel button when processing', () => {
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                isProcessing={true}
            />,
        );
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    test('should call onCancelProcessing when cancel button is clicked', () => {
        const onCancelProcessing = jest.fn();
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                isProcessing={true}
                onCancelProcessing={onCancelProcessing}
            />,
        );
        fireEvent.click(screen.getByText('Cancel'));
        expect(onCancelProcessing).toHaveBeenCalled();
    });

    test('should render undo and regenerate buttons when not processing and original message exists', () => {
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                isProcessing={false}
                originalMessage='Original message'
                lastAction={RewriteAction.SHORTEN}
            />,
        );
        expect(screen.getByText('Undo')).toBeInTheDocument();
        expect(screen.getByText('Regenerate')).toBeInTheDocument();
    });

    test('should not render undo and regenerate buttons when processing', () => {
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                isProcessing={true}
                originalMessage='Original message'
                lastAction={RewriteAction.SHORTEN}
            />,
        );
        expect(screen.queryByText('Undo')).not.toBeInTheDocument();
        expect(screen.queryByText('Regenerate')).not.toBeInTheDocument();
    });

    test('should call onUndoMessage when undo button is clicked', () => {
        const onUndoMessage = jest.fn();
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                isProcessing={false}
                originalMessage='Original message'
                lastAction={RewriteAction.SHORTEN}
                onUndoMessage={onUndoMessage}
            />,
        );
        fireEvent.click(screen.getByText('Undo'));
        expect(onUndoMessage).toHaveBeenCalled();
    });

    test('should call onRegenerateMessage when regenerate button is clicked', () => {
        const onRegenerateMessage = jest.fn();
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                isProcessing={false}
                originalMessage='Original message'
                lastAction={RewriteAction.SHORTEN}
                onRegenerateMessage={onRegenerateMessage}
            />,
        );
        fireEvent.click(screen.getByText('Regenerate'));
        expect(onRegenerateMessage).toHaveBeenCalled();
    });

    test('should call onMenuAction when menu item is clicked', () => {
        const onMenuAction = jest.fn(() => () => {});
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                onMenuAction={onMenuAction}
                draftMessage='Test message'
            />,
        );
        const menuItems = screen.getAllByTestId('menu-item');
        fireEvent.click(menuItems[0]);
        expect(onMenuAction).toHaveBeenCalled();
    });

    test('should call setPrompt when prompt input changes', () => {
        const setPrompt = jest.fn();
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                setPrompt={setPrompt}
            />,
        );
        const input = screen.getByTestId('prompt-input-field');
        fireEvent.change(input, {target: {value: 'New prompt'}});
        expect(setPrompt).toHaveBeenCalled();
    });

    test('should call onCustomPromptKeyDown when key is pressed in prompt input', () => {
        const onCustomPromptKeyDown = jest.fn();
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                onCustomPromptKeyDown={onCustomPromptKeyDown}
            />,
        );
        const input = screen.getByTestId('prompt-input-field');
        fireEvent.keyDown(input, {key: 'Enter'});
        expect(onCustomPromptKeyDown).toHaveBeenCalled();
    });

    test('should disable prompt input when processing', () => {
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                isProcessing={true}
            />,
        );
        const input = screen.getByTestId('prompt-input-field');
        expect(input).toBeDisabled();
    });

    test('should show placeholder text based on state', () => {
        const {rerender} = renderWithContext(
            <RewriteMenu
                {...baseProps}
                draftMessage='Test message'
            />,
        );
        let input = screen.getByTestId('prompt-input-field');
        expect(input).toHaveAttribute('placeholder', 'Ask AI to edit message...');

        rerender(
            <RewriteMenu
                {...baseProps}
                draftMessage=''
            />,
        );
        input = screen.getByTestId('prompt-input-field');
        expect(input).toHaveAttribute('placeholder', 'Create a new message...');

        rerender(
            <RewriteMenu
                {...baseProps}
                isProcessing={true}
                draftMessage='Test message'
            />,
        );
        input = screen.getByTestId('prompt-input-field');
        expect(input).toHaveAttribute('placeholder', 'Rewriting...');

        rerender(
            <RewriteMenu
                {...baseProps}
                isProcessing={true}
                prompt='Custom prompt'
            />,
        );
        input = screen.getByTestId('prompt-input-field');
        expect(input).toHaveAttribute('placeholder', 'Custom prompt');
    });

    test('should disable agent dropdown when processing', () => {
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                isProcessing={true}
            />,
        );
        const select = screen.getByTestId('agent-select');
        expect(select).toBeDisabled();
    });

    test('should call setSelectedAgentId when agent is selected', () => {
        const setSelectedAgentId = jest.fn();
        renderWithContext(
            <RewriteMenu
                {...baseProps}
                setSelectedAgentId={setSelectedAgentId}
            />,
        );
        const select = screen.getByTestId('agent-select');
        fireEvent.change(select, {target: {value: 'agent2'}});
        expect(setSelectedAgentId).toHaveBeenCalledWith('agent2');
    });
});

