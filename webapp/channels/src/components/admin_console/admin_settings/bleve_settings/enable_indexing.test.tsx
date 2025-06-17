// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import EnableIndexing from './enable_indexing';

import {useIsSetByEnv} from '../hooks';

// Mock the hooks
jest.mock('../hooks', () => ({
    useIsSetByEnv: jest.fn(),
}));

describe('EnableIndexing', () => {
    const defaultProps = {
        value: false,
        onChange: jest.fn(),
        isDisabled: false,
    };

    beforeEach(() => {
        jest.mocked(useIsSetByEnv).mockReturnValue(false);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render the component with correct label and help text', () => {
        renderWithContext(<EnableIndexing {...defaultProps}/>);

        expect(screen.getByText('Enable Bleve Indexing:')).toBeInTheDocument();
        expect(screen.getByText(/When true, indexing of new posts occurs automatically/)).toBeInTheDocument();
    });

    it('should render BooleanSetting with correct props when not disabled', () => {
        renderWithContext(<EnableIndexing {...defaultProps}/>);

        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).toBeChecked();
        expect(trueRadio).not.toBeChecked();
        expect(falseRadio).not.toBeDisabled();
        expect(trueRadio).not.toBeDisabled();
    });

    it('should render BooleanSetting as checked when value is true', () => {
        renderWithContext(
            <EnableIndexing
                {...defaultProps}
                value={true}
            />,
        );

        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).not.toBeChecked();
        expect(trueRadio).toBeChecked();
    });

    it('should disable the setting when isDisabled is true', () => {
        renderWithContext(
            <EnableIndexing
                {...defaultProps}
                isDisabled={true}
            />,
        );

        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).toBeDisabled();
        expect(trueRadio).toBeDisabled();
    });

    it('should call onChange when checkbox is clicked', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <EnableIndexing
                {...defaultProps}
                onChange={onChange}
            />,
        );

        const trueRadio = screen.getByRole('radio', {name: 'True'});
        await userEvent.click(trueRadio);

        expect(onChange).toHaveBeenCalledWith('enableIndexing', true);
    });

    it('should show set by environment indicator when setByEnv is true', () => {
        jest.mocked(useIsSetByEnv).mockReturnValue(true);
        renderWithContext(<EnableIndexing {...defaultProps}/>);

        // If set by env, the setting should be disabled
        const falseRadio = screen.getByRole('radio', {name: 'False'});
        const trueRadio = screen.getByRole('radio', {name: 'True'});
        expect(falseRadio).toBeDisabled();
        expect(trueRadio).toBeDisabled();
    });

    it('should have correct field ID', () => {
        renderWithContext(<EnableIndexing {...defaultProps}/>);

        const fieldset = screen.getByRole('group', {name: 'Enable Bleve Indexing:'});
        expect(fieldset).toHaveAttribute('id', 'enableIndexing');
    });

    it('should render external link in help text', () => {
        renderWithContext(<EnableIndexing {...defaultProps}/>);

        const link = screen.getByRole('link', {name: /Learn more about Bleve in our documentation/i});
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', expect.stringContaining('bleve-search.html'));
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
});
