// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ClassificationEnforcement from './classification_enforcement';

const mockPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: mockPush}),
}));

describe('ClassificationEnforcement', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the clearance checkbox reflecting the enabled prop', () => {
        const {rerender} = renderWithContext(
            <ClassificationEnforcement
                clearanceEnabled={false}
                onClearanceEnabledChange={jest.fn()}
            />,
        );

        const checkbox = screen.getByTestId('clearanceAttributeCheckbox') as HTMLInputElement;
        expect(checkbox).not.toBeChecked();

        rerender(
            <ClassificationEnforcement
                clearanceEnabled={true}
                onClearanceEnabledChange={jest.fn()}
            />,
        );
        expect(screen.getByTestId('clearanceAttributeCheckbox')).toBeChecked();
    });

    it('calls onClearanceEnabledChange when toggled', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <ClassificationEnforcement
                clearanceEnabled={false}
                onClearanceEnabledChange={onChange}
            />,
        );

        await userEvent.click(screen.getByTestId('clearanceAttributeCheckbox'));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('does not render the old dropdown or create button', () => {
        renderWithContext(
            <ClassificationEnforcement
                clearanceEnabled={false}
                onClearanceEnabledChange={jest.fn()}
            />,
        );

        expect(screen.queryByText('Create new')).not.toBeInTheDocument();
    });

    it('navigates to the membership policies page via the inline link', async () => {
        renderWithContext(
            <ClassificationEnforcement
                clearanceEnabled={false}
                onClearanceEnabledChange={jest.fn()}
            />,
        );

        await userEvent.click(screen.getByText('membership policy'));
        expect(mockPush).toHaveBeenCalledWith('/admin_console/system_attributes/membership_policies');
    });
});
