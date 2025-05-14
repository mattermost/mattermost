// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LogLevelEnum} from '@mattermost/types/admin';

import {renderWithContext, userEvent, screen, waitFor} from 'tests/react_testing_utils';

import Logs from './logs';

describe('components/admin_console/server_logs/Logs', () => {
    // Log dataset
    const logs = [{
        caller: 'caller 1',
        job_id: 'job_id 1',
        level: LogLevelEnum.INFO,
        msg: 'msg 1',
        timestamp: 'timestamp 1',
        worker: 'worker 1',
        whatever: 'whatever 1',
    }, {
        caller: 'caller 2',
        job_id: 'job_id 2',
        level: LogLevelEnum.INFO,
        msg: 'msg 2',
        timestamp: 'timestamp 2',
        worker: 'worker 2',
        whatever: 'whatever 2',
    }, {
        caller: 'filtered',
        job_id: 'filtered',
        level: LogLevelEnum.INFO,
        msg: 'filtered message',
        timestamp: 'filtered',
        worker: 'filtered',
        whatever: 'filtered',
    }];
    let container: HTMLElement;

    beforeEach(async () => {
        // Mount server log screen
        container = renderWithContext(
            <Logs
                logs={logs}
                plainLogs={[]}
                isPlainLogs={false}
                actions={{getLogs: jest.fn(), getPlainLogs: jest.fn()}}
            />,
        ).container;

        // Wait for the logs to be displayed
        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
            expect(screen.queryByText('msg 1')).toBeInTheDocument();
            expect(screen.queryByText('msg 2')).toBeInTheDocument();
            expect(screen.queryByText('filtered message')).toBeInTheDocument();
        });
    });

    test('should display the logs correctly after loading', () => {
        expect(container).toMatchSnapshot();
    });

    test.each(['caller', 'msg', 'worker', 'job_id', 'whatever'])('should search input be performed on %s attribute',
        async (searchString: string) => {
            const searchInput = screen.getByTestId('searchInput');
            userEvent.type(searchInput, searchString);

            await waitFor(() => {
                expect(screen.queryByText('msg 1')).toBeInTheDocument();
                expect(screen.queryByText('msg 2')).toBeInTheDocument();
                expect(screen.queryByText('filtered message')).not.toBeInTheDocument();
            });
        });

    test.each(['level', 'timestamp'])('should search input not be performed on %s attribute',
        async (searchString: string) => {
            const searchInput = screen.getByTestId('searchInput');
            userEvent.type(searchInput, searchString);

            await waitFor(() => {
                expect(screen.queryByText('msg 1')).not.toBeInTheDocument();
                expect(screen.queryByText('msg 2')).not.toBeInTheDocument();
                expect(screen.queryByText('filtered message')).not.toBeInTheDocument();
            });
        });
});
