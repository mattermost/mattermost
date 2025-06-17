// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import EnableAutocomplete from './enable_autocomplete';

import {useIsSetByEnv} from '../hooks';

// Mock the hooks
jest.mock('../hooks', () => ({
    useIsSetByEnv: jest.fn(),
}));

describe('EnableAutocomplete', () => {
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
        renderWithContext(<EnableAutocomplete {...defaultProps}/>);

        expect(screen.getByText('Enable Bleve for autocomplete queries:')).toBeInTheDocument();
        expect(screen.getByText(/When true, Bleve will be used for all autocompletion queries/)).toBeInTheDocument();
    });

    it('should render BooleanSetting with correct props when indexing is enabled', () => {
        renderWithContext(<EnableAutocomplete {...defaultProps}/>);

        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).toBeChecked();
        expect(trueRadio).not.toBeChecked();
        expect(falseRadio).not.toBeDisabled();
        expect(trueRadio).not.toBeDisabled();
    });

    it('should render BooleanSetting as checked when value is true', () => {
        renderWithContext(
            <EnableAutocomplete
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
            <EnableAutocomplete
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
            <EnableAutocomplete
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
            <EnableAutocomplete
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
            <EnableAutocomplete
                {...defaultProps}
                onChange={onChange}
            />,
        );

        const trueRadio = screen.getByRole('radio', {name: 'True'});
        await userEvent.click(trueRadio);

        expect(onChange).toHaveBeenCalledWith('enableAutocomplete', true);
    });

    it('should show set by environment indicator when setByEnv is true', () => {
        jest.mocked(useIsSetByEnv).mockReturnValue(true);
        renderWithContext(<EnableAutocomplete {...defaultProps}/>);

        // If set by env, the setting should be disabled
        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).toBeDisabled();
        expect(trueRadio).toBeDisabled();
    });

    it('should have correct field ID', () => {
        renderWithContext(<EnableAutocomplete {...defaultProps}/>);

        const fieldset = screen.getByRole('group', {name: 'Enable Bleve for autocomplete queries:'});
        expect(fieldset).toHaveAttribute('id', 'enableAutocomplete');
    });
});
