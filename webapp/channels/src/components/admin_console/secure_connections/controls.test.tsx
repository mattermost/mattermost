// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {ConnectionStatusLabel, FormField, ModalFieldset} from './controls';

const baseRC = {
    remote_id: 'rc-1',
    name: 'acme',
    display_name: 'Acme',
    site_url: 'https://siteurl',
    last_ping_at: 0,
} as RemoteCluster;

describe('ConnectionStatusLabel', () => {
    it('renders "Connection Pending" when site_url is pending', () => {
        const rc = {...baseRC, site_url: 'pending_https://siteurl'} as RemoteCluster;

        renderWithContext(<ConnectionStatusLabel rc={rc}/>);

        expect(screen.getByText('Connection Pending')).toBeInTheDocument();
    });

    it('renders "Connected" when confirmed and last_ping_at is recent', () => {
        const rc = {...baseRC, last_ping_at: Date.now() - (60 * 1000)} as RemoteCluster;

        renderWithContext(<ConnectionStatusLabel rc={rc}/>);

        expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('renders "Offline" when confirmed but last_ping_at is stale', () => {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        const rc = {...baseRC, last_ping_at: tenMinutesAgo} as RemoteCluster;

        renderWithContext(<ConnectionStatusLabel rc={rc}/>);

        expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('renders "Offline" with no tooltip wrapper when last_ping_at is 0', () => {
        renderWithContext(<ConnectionStatusLabel rc={baseRC}/>);

        expect(screen.getByText('Offline')).toBeInTheDocument();
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
    });
});
