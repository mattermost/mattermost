// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {ConnectionStatusLabel, FormField, ModalFieldset} from './controls';

const baseRC = TestHelper.getRemoteClusterMock({
    remote_id: 'rc-1',
    name: 'acme',
    display_name: 'Acme',
    site_url: 'https://siteurl',
    last_ping_at: 0,
});

describe('ConnectionStatusLabel', () => {
    it('renders "Connection Pending" when site_url is pending', () => {
        const rc = {...baseRC, site_url: 'pending_https://siteurl'};

        renderWithContext(<ConnectionStatusLabel rc={rc}/>);

        expect(screen.getByText('Connection Pending')).toBeInTheDocument();
    });

    it('renders "Connected" when confirmed and last_ping_at is recent', () => {
        const rc = {...baseRC, last_ping_at: Date.now() - 5_000};

        renderWithContext(<ConnectionStatusLabel rc={rc}/>);

        expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('renders "Offline" with a last-ping tooltip when confirmed but last_ping_at is stale', async () => {
        jest.useFakeTimers();
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        const rc = {...baseRC, last_ping_at: tenMinutesAgo};

        renderWithContext(<ConnectionStatusLabel rc={rc}/>);

        expect(screen.getByText('Offline')).toBeInTheDocument();

        await userEvent.hover(screen.getByText('Offline'), {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText(/Last ping:/)).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    it('renders "Offline" with no tooltip wrapper when last_ping_at is 0', async () => {
        jest.useFakeTimers();

        renderWithContext(<ConnectionStatusLabel rc={baseRC}/>);

        expect(screen.getByText('Offline')).toBeInTheDocument();

        await userEvent.hover(screen.getByText('Offline'), {advanceTimers: jest.advanceTimersByTime});
        jest.advanceTimersByTime(1000);

        expect(screen.queryByText(/Last ping:/)).not.toBeInTheDocument();

        jest.useRealTimers();
    });
});

describe('FormField', () => {
    it('renders the label, children, and helpText', () => {
        renderWithContext(
            <FormField
                label='My label'
                helpText='Some help text'
            >
                <input data-testid='child-input'/>
            </FormField>,
        );

        expect(screen.getByText('My label')).toBeInTheDocument();
        expect(screen.getByText('Some help text')).toBeInTheDocument();
        expect(screen.getByTestId('child-input')).toBeInTheDocument();
    });

    it('omits the label and helpText when not provided', () => {
        renderWithContext(
            <FormField>
                <input data-testid='child-input'/>
            </FormField>,
        );

        expect(screen.getByTestId('child-input')).toBeInTheDocument();
        expect(screen.queryByText('My label')).not.toBeInTheDocument();
        expect(screen.queryByText('Some help text')).not.toBeInTheDocument();
    });
});

describe('ModalFieldset', () => {
    it('renders the legend and children', () => {
        renderWithContext(
            <ModalFieldset legend='Section title'>
                <span data-testid='child'>{'inner'}</span>
            </ModalFieldset>,
        );

        expect(screen.getByText('Section title')).toBeInTheDocument();
        expect(screen.getByTestId('child')).toHaveTextContent('inner');
    });

    it('omits the legend when not provided', () => {
        renderWithContext(
            <ModalFieldset>
                <span data-testid='child'>{'inner'}</span>
            </ModalFieldset>,
        );

        expect(screen.getByTestId('child')).toBeInTheDocument();
        expect(screen.queryByText('Section title')).not.toBeInTheDocument();
    });
});
