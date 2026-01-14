// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import AIToolsDropdown from './ai_tools_dropdown';

jest.mock('components/menu', () => ({
    ...jest.requireActual('components/menu'),
    Container: ({children, menuButton, menuHeader}: any) => (
        <div data-testid='menu-container'>
            <div data-testid='menu-header'>{menuHeader}</div>
            <button
                data-testid='menu-button'
                disabled={menuButton.disabled}
                aria-label={menuButton['aria-label']}
                className={menuButton.class}
            >
                {menuButton.children}
            </button>
            <div data-testid='menu-items'>{children}</div>
        </div>
    ),
    Item: ({labels, onClick, leadingElement, id, subMenuDetail}: any) => (
        <button
            data-testid={id}
            onClick={onClick}
        >
            {leadingElement}
            {labels}
            <span data-testid='menu-item-description'>{subMenuDetail}</span>
        </button>
    ),
}));

describe('AIToolsDropdown', () => {
    const defaultProps = {
        onProofread: jest.fn(),
        isProcessing: false,
        disabled: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render with default state', () => {
        renderWithContext(<AIToolsDropdown {...defaultProps}/>);

        expect(screen.getByTestId('menu-container')).toBeInTheDocument();
        expect(screen.getByTestId('menu-button')).toBeInTheDocument();
        expect(screen.getByTestId('ai-proofread-page')).toBeInTheDocument();
    });

    it('should display "AI" text when not processing', () => {
        renderWithContext(<AIToolsDropdown {...defaultProps}/>);

        expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('should display "Processing..." text when processing', () => {
        renderWithContext(
            <AIToolsDropdown
                {...defaultProps}
                isProcessing={true}
            />,
        );

        expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should call onProofread when proofread item is clicked', () => {
        renderWithContext(<AIToolsDropdown {...defaultProps}/>);

        const proofreadItem = screen.getByTestId('ai-proofread-page');
        fireEvent.click(proofreadItem);

        expect(defaultProps.onProofread).toHaveBeenCalledTimes(1);
    });

    it('should not call onProofread when processing', () => {
        const onProofread = jest.fn();
        renderWithContext(
            <AIToolsDropdown
                {...defaultProps}
                onProofread={onProofread}
                isProcessing={true}
            />,
        );

        const proofreadItem = screen.getByTestId('ai-proofread-page');
        fireEvent.click(proofreadItem);

        expect(onProofread).not.toHaveBeenCalled();
    });

    it('should not call onProofread when disabled', () => {
        const onProofread = jest.fn();
        renderWithContext(
            <AIToolsDropdown
                {...defaultProps}
                onProofread={onProofread}
                disabled={true}
            />,
        );

        const proofreadItem = screen.getByTestId('ai-proofread-page');
        fireEvent.click(proofreadItem);

        expect(onProofread).not.toHaveBeenCalled();
    });

    it('should disable button when processing', () => {
        renderWithContext(
            <AIToolsDropdown
                {...defaultProps}
                isProcessing={true}
            />,
        );

        const button = screen.getByTestId('menu-button');
        expect(button).toBeDisabled();
    });

    it('should disable button when disabled prop is true', () => {
        renderWithContext(
            <AIToolsDropdown
                {...defaultProps}
                disabled={true}
            />,
        );

        const button = screen.getByTestId('menu-button');
        expect(button).toBeDisabled();
    });

    it('should render proofread page label', () => {
        renderWithContext(<AIToolsDropdown {...defaultProps}/>);

        expect(screen.getByText('Proofread page')).toBeInTheDocument();
    });

    it('should render AI TOOLS header', () => {
        renderWithContext(<AIToolsDropdown {...defaultProps}/>);

        expect(screen.getByText('AI TOOLS')).toBeInTheDocument();
    });
});
