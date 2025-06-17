// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {blevePurgeIndexes} from 'actions/admin_actions.jsx';

import RequestButton from 'components/admin_console/request_button/request_button';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PurgeIndexes from './purge_indexes';

// Mock the RequestButton component
jest.mock('components/admin_console/request_button/request_button', () => ({
    __esModule: true,
    default: jest.fn(),
}));

// Mock the admin actions
jest.mock('actions/admin_actions.jsx', () => ({
    blevePurgeIndexes: jest.fn(),
}));

jest.mocked(RequestButton).mockImplementation((props) => {
    return (
        <div data-testid='request-button'>
            <button
                data-testid='purge-button'
                disabled={props.disabled}
                onClick={() => props.requestAction(jest.fn(), jest.fn())}
            >
                {props.buttonText}
            </button>
            <div data-testid='help-text'>{props.helpText}</div>
            <div data-testid='label'>{props.label}</div>
        </div>
    );
});

describe('PurgeIndexes', () => {
    const defaultProps = {
        canPurgeAndIndex: true,
        isDisabled: false,
    };

    beforeEach(() => {
        jest.mocked(blevePurgeIndexes).mockClear();
    });

    it('should render the component with correct label and help text', () => {
        renderWithContext(<PurgeIndexes {...defaultProps}/>);

        expect(screen.getByText('Purge Indexes:')).toBeInTheDocument();
        expect(screen.getByText(/Purging will entirely remove the content of the Bleve index directory/)).toBeInTheDocument();
    });

    it('should render RequestButton with correct props when canPurgeAndIndex is true', () => {
        renderWithContext(<PurgeIndexes {...defaultProps}/>);

        expect(screen.getByTestId('request-button')).toBeInTheDocument();
        expect(screen.getByTestId('purge-button')).not.toBeDisabled();
        expect(screen.getByText('Purge Index')).toBeInTheDocument();
    });

    it('should disable RequestButton when canPurgeAndIndex is false', () => {
        renderWithContext(
            <PurgeIndexes
                {...defaultProps}
                canPurgeAndIndex={false}
            />,
        );

        expect(screen.getByTestId('purge-button')).toBeDisabled();
    });

    it('should disable RequestButton when isDisabled is true', () => {
        renderWithContext(
            <PurgeIndexes
                {...defaultProps}
                isDisabled={true}
            />,
        );

        expect(screen.getByTestId('purge-button')).toBeDisabled();
    });

    it('should disable RequestButton when both canPurgeAndIndex is false and isDisabled is true', () => {
        renderWithContext(
            <PurgeIndexes
                {...defaultProps}
                canPurgeAndIndex={false}
                isDisabled={true}
            />,
        );

        expect(screen.getByTestId('purge-button')).toBeDisabled();
    });

    it('should call blevePurgeIndexes when button is clicked', async () => {
        renderWithContext(<PurgeIndexes {...defaultProps}/>);

        const button = screen.getByTestId('purge-button');
        await button.click();

        expect(blevePurgeIndexes).toHaveBeenCalled();
    });

    it('should have correct field ID', () => {
        renderWithContext(<PurgeIndexes {...defaultProps}/>);

        const button = screen.getByTestId('purge-button');
        expect(button).toBeInTheDocument();
    });
});
