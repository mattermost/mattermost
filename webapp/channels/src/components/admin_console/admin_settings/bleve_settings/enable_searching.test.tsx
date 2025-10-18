// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import EnableSearching from './enable_searching';

import {useIsSetByEnv} from '../hooks';

// Mock the hooks
jest.mock('../hooks', () => ({
    useIsSetByEnv: jest.fn(),
}));

describe('EnableSearching', () => {
    const defaultProps = {
        value: false,
        onChange: jest.fn(),
        isDisabled: false,
        indexingEnabled: true,
    };

    beforeEach(() => {
        jest.mocked(useIsSetByEnv).mockReturnValue(false);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render the component with correct label and help text', () => {
        renderWithContext(<EnableSearching {...defaultProps}/>);

        expect(screen.getByText('Enable Bleve for search queries:')).toBeInTheDocument();
        expect(screen.getByText(/When true, Bleve will be used for all search queries/)).toBeInTheDocument();
    });

    it('should render BooleanSetting with correct props when indexing is enabled', () => {
        renderWithContext(<EnableSearching {...defaultProps}/>);

        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).toBeChecked();
        expect(trueRadio).not.toBeChecked();
        expect(falseRadio).not.toBeDisabled();
        expect(trueRadio).not.toBeDisabled();
    });

    it('should render BooleanSetting as checked when value is true', () => {
        renderWithContext(
            <EnableSearching
                {...defaultProps}
                value={true}
            />,
        );

        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(trueRadio).toBeChecked();
        expect(falseRadio).not.toBeChecked();
    });

    it('should disable the setting when indexing is not enabled', () => {
        renderWithContext(
            <EnableSearching
                {...defaultProps}
                indexingEnabled={false}
            />,
        );

        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).toBeDisabled();
        expect(trueRadio).toBeDisabled();
    });

    it('should disable the setting when isDisabled is true', () => {
        renderWithContext(
            <EnableSearching
                {...defaultProps}
                isDisabled={true}
            />,
        );

        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).toBeDisabled();
        expect(trueRadio).toBeDisabled();
    });

    it('should disable the setting when both indexing is disabled and isDisabled is true', () => {
        renderWithContext(
            <EnableSearching
                {...defaultProps}
                indexingEnabled={false}
                isDisabled={true}
            />,
        );

        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).toBeDisabled();
        expect(trueRadio).toBeDisabled();
    });

    it('should call onChange when radio is clicked', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <EnableSearching
                {...defaultProps}
                onChange={onChange}
            />,
        );

        const trueRadio = screen.getByRole('radio', {name: 'True'});
        await userEvent.click(trueRadio);

        expect(onChange).toHaveBeenCalledWith('enableSearching', true);
    });

    it('should show set by environment indicator when setByEnv is true', () => {
        jest.mocked(useIsSetByEnv).mockReturnValue(true);
        renderWithContext(<EnableSearching {...defaultProps}/>);

        // If set by env, the setting should be disabled
        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).toBeDisabled();
        expect(trueRadio).toBeDisabled();
    });

    it('should have correct field ID', () => {
        renderWithContext(<EnableSearching {...defaultProps}/>);

        const fieldset = screen.getByRole('group', {name: 'Enable Bleve for search queries:'});
        expect(fieldset).toHaveAttribute('id', 'enableSearching');
    });
});
