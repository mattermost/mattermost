// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import BoardAttributes from './board_attributes';

// Mock the table hook so we can test the screen's wiring without
// dragging in API integration / Redux fetch flow.
const mockSave = jest.fn();
const mockUseBoardAttributesTable = jest.fn();

jest.mock('./board_attributes_table', () => ({
    useBoardAttributesTable: () => mockUseBoardAttributesTable(),
}));

// Mock the navigation-blocked action so we can assert it dispatches with
// the correct hasChanges value. The real action returns a sync action object
// the store handles; this returns a marker we can detect on dispatch.
const mockSetNavigationBlocked = jest.fn((blocked: boolean) => ({type: 'SET_NAVIGATION_BLOCKED_TEST', blocked}));
jest.mock('actions/admin_actions', () => ({
    setNavigationBlocked: (blocked: boolean) => mockSetNavigationBlocked(blocked),
}));

function makeHookReturn(overrides: Partial<{
    content: React.ReactNode;
    saving: boolean;
    hasChanges: boolean;
    isValid: boolean;
    saveError: unknown;
    save: () => void;
}> = {}) {
    return {
        content: <div data-testid='table-content'>{'table content'}</div>,
        saving: false,
        hasChanges: false,
        isValid: true,
        saveError: undefined,
        save: mockSave,
        ...overrides,
    };
}

describe('BoardAttributes (top-level screen)', () => {
    beforeEach(() => {
        // Use mockReset on both for consistency — it clears state AND any
        // configured implementation/return value, so test-to-test isolation is
        // guaranteed even if a future test adds .mockReturnValue or similar.
        mockSave.mockReset();
        mockUseBoardAttributesTable.mockReset();
        mockSetNavigationBlocked.mockClear();
    });

    it('renders the page title, section header, and the table content from the hook', () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn());

        renderWithContext(<BoardAttributes disabled={false}/>);

        expect(screen.getByTestId('boardAttributes')).toBeInTheDocument();
        expect(screen.getAllByText(/board attributes/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/customize the attributes available by default/i)).toBeInTheDocument();
        expect(screen.getByTestId('table-content')).toBeInTheDocument();
    });

    it('disables the save button when no changes are pending', () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn({hasChanges: false}));

        renderWithContext(<BoardAttributes disabled={false}/>);

        const save = screen.getByRole('button', {name: /^save$/i});
        expect(save).toBeDisabled();
    });

    it('enables the save button when changes are pending and the form is valid', () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn({hasChanges: true, isValid: true}));

        renderWithContext(<BoardAttributes disabled={false}/>);

        const save = screen.getByRole('button', {name: /^save$/i});
        expect(save).toBeEnabled();
    });

    it('disables the save button when the form has validation errors (isValid=false)', () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn({hasChanges: true, isValid: false}));

        renderWithContext(<BoardAttributes disabled={false}/>);

        const save = screen.getByRole('button', {name: /^save$/i});
        expect(save).toBeDisabled();
    });

    it('disables the save button when the surrounding admin section is disabled', () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn({hasChanges: true, isValid: true}));

        renderWithContext(<BoardAttributes disabled={true}/>);

        const save = screen.getByRole('button', {name: /^save$/i});
        expect(save).toBeDisabled();
    });

    it('swaps the Save button label to the saving-in-progress message and disables it while saving=true', () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn({hasChanges: true, isValid: true, saving: true}));

        renderWithContext(<BoardAttributes disabled={false}/>);

        // While saving, the "Save" label is replaced by the savingMessage we pass to SaveChangesPanel.
        expect(screen.queryByRole('button', {name: /^save$/i})).not.toBeInTheDocument();
        const savingButton = screen.getByRole('button', {name: /saving configuration/i});
        expect(savingButton).toBeDisabled();
    });

    it('calls save() when the Save button is clicked', async () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn({hasChanges: true, isValid: true}));

        renderWithContext(<BoardAttributes disabled={false}/>);

        await userEvent.click(screen.getByRole('button', {name: /^save$/i}));

        expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('renders the server-error message when saveError is set', () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn({
            hasChanges: true,
            isValid: true,
            saveError: new Error('boom'),
        }));

        renderWithContext(<BoardAttributes disabled={false}/>);

        expect(screen.getByText(/there was an error while saving the configuration/i)).toBeInTheDocument();
    });

    it('dispatches setNavigationBlocked(false) on initial mount when hasChanges=false', () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn({hasChanges: false}));

        renderWithContext(<BoardAttributes disabled={false}/>);

        expect(mockSetNavigationBlocked).toHaveBeenCalledWith(false);
    });

    it('dispatches setNavigationBlocked(true) when there are unsaved changes', () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn({hasChanges: true}));

        renderWithContext(<BoardAttributes disabled={false}/>);

        expect(mockSetNavigationBlocked).toHaveBeenCalledWith(true);
    });

    it('dispatches setNavigationBlocked(false) on unmount so the block does not leak into the next screen', () => {
        mockUseBoardAttributesTable.mockReturnValue(makeHookReturn({hasChanges: true}));

        const {unmount} = renderWithContext(<BoardAttributes disabled={false}/>);

        // Effect set the block to `true` on mount; clear the spy before
        // unmount so the assertion is unambiguous about what unmount did.
        mockSetNavigationBlocked.mockClear();

        unmount();

        expect(mockSetNavigationBlocked).toHaveBeenCalledWith(false);
    });
});
