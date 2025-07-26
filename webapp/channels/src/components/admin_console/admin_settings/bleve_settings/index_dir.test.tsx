// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import IndexDir from './index_dir';

import {useIsSetByEnv} from '../hooks';

// Mock the hooks
jest.mock('../hooks', () => ({
    useIsSetByEnv: jest.fn(),
}));

describe('IndexDir', () => {
    const defaultProps = {
        value: '',
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
        renderWithContext(<IndexDir {...defaultProps}/>);

        expect(screen.getByText('Index Directory:')).toBeInTheDocument();
        expect(screen.getByText('Directory path to use for store bleve indexes.')).toBeInTheDocument();
    });

    it('should render TextSetting with correct props when not disabled', () => {
        renderWithContext(<IndexDir {...defaultProps}/>);

        const input = screen.getByRole('textbox');
        expect(input).toHaveValue('');
        expect(input).not.toBeDisabled();
    });

    it('should render TextSetting with value when provided', () => {
        renderWithContext(
            <IndexDir
                {...defaultProps}
                value='/path/to/index'
            />,
        );

        const input = screen.getByRole('textbox');
        expect(input).toHaveValue('/path/to/index');
    });

    it('should disable the setting when isDisabled is true', () => {
        renderWithContext(
            <IndexDir
                {...defaultProps}
                isDisabled={true}
            />,
        );

        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
    });

    it('should call onChange when input value changes', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <IndexDir
                {...defaultProps}
                onChange={onChange}
            />,
        );

        const input = screen.getByRole('textbox');
        await userEvent.type(input, 'n');

        expect(onChange).toHaveBeenCalledWith('indexDir', 'n');
    });

    it('should show set by environment indicator when setByEnv is true', () => {
        jest.mocked(useIsSetByEnv).mockReturnValue(true);
        renderWithContext(<IndexDir {...defaultProps}/>);

        // If set by env, the setting should be disabled
        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
    });
});
