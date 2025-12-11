// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import type {Props} from './table';
import JobTable from './table';

describe('components/admin_console/jobs/table', () => {
    const createJobButtonText = (
        <FormattedMessage
            id='admin.complianceExport.createJob.title'
            defaultMessage='Run Compliance Export Job Now'
        />
    );

    const createJobHelpText = (
        <FormattedMessage
            id='admin.complianceExport.createJob.help'
            defaultMessage='Initiates a Compliance Export job immediately.'
        />
    );
    const cancelJob = vi.fn(() => Promise.resolve({}));
    const createJob = vi.fn(() => Promise.resolve({}));
    const getJobsByType = vi.fn(() => Promise.resolve({}));

    const baseProps: Props = {
        createJobButtonText,
        createJobHelpText,
        disabled: false,
        actions: {
            cancelJob,
            createJob,
            getJobsByType,
        },
        jobType: 'data_retention',
        jobs: [{
            create_at: 1540834294674,
            last_activity_at: 1540834294674,
            id: '1231',
            status: 'success',
            type: 'data_retention',
            priority: 0,
            start_at: 0,
            progress: 0,
            data: '',
        }, {
            create_at: 1540834294674,
            last_activity_at: 1540834294674,
            id: '1232',
            status: 'pending',
            type: 'data_retention',
            priority: 0,
            start_at: 0,
            progress: 0,
            data: '',
        }, {
            create_at: 1540834294674,
            last_activity_at: 1540834294674,
            id: '1233',
            status: 'in_progress',
            type: 'data_retention',
            priority: 0,
            start_at: 0,
            progress: 0,
            data: '',
        }, {
            create_at: 1540834294674,
            last_activity_at: 1540834294674,
            id: '1234',
            status: 'cancel_requested',
            type: 'data_retention',
            priority: 0,
            start_at: 0,
            progress: 0,
            data: '',
        }, {
            create_at: 1540834294674,
            last_activity_at: 1540834294674,
            id: '1235',
            status: 'canceled',
            type: 'data_retention',
            priority: 0,
            start_at: 0,
            progress: 0,
            data: '',
        }, {
            create_at: 1540834294674,
            last_activity_at: 1540834294674,
            id: '1236',
            status: 'error',
            type: 'data_retention',
            priority: 0,
            start_at: 0,
            progress: 0,
            data: '',
        }, {
            create_at: 1540834294674,
            last_activity_at: 1540834294674,
            id: '1237',
            status: 'warning',
            type: 'data_retention',
            priority: 0,
            start_at: 0,
            progress: 0,
            data: '',
        }],
    };

    test('should call create job func', () => {
        const {container} = renderWithContext(
            <JobTable {...baseProps}/>,
        );

        const createButton = container.querySelector('.job-table__create-button .btn-tertiary');
        expect(createButton).toBeInTheDocument();
        fireEvent.click(createButton!);
        expect(createJob).toHaveBeenCalledTimes(1);
    });

    test('should call cancel job func', () => {
        const {container} = renderWithContext(
            <JobTable {...baseProps}/>,
        );

        // Find the cancel button (JobCancelButton component renders with class 'JobCancelButton')
        // Only jobs with status 'pending' or 'in_progress' have cancel buttons
        const cancelButtons = container.querySelectorAll('.JobCancelButton');
        expect(cancelButtons.length).toBeGreaterThan(0);

        // Click the first cancel button
        fireEvent.click(cancelButtons[0]);
        expect(cancelJob).toHaveBeenCalledTimes(1);
    });

    test('files column should show', () => {
        const {container} = renderWithContext(
            <JobTable
                {...baseProps}
                jobType='message_export'
                downloadExportResults={true}
            />,
        );

        // There should be ONLY 1 table element
        const tables = container.querySelectorAll('table');
        expect(tables).toHaveLength(1);

        // The table should have ONLY 1 thead element
        const theads = container.querySelectorAll('thead');
        expect(theads).toHaveLength(1);

        // The number of th tags should be equal to number of columns (6 with Files column)
        const headers = container.querySelectorAll('thead th');
        expect(headers).toHaveLength(6);

        // Verify Files column is present
        expect(screen.getByText('Files')).toBeInTheDocument();
    });

    test('files column should not show', () => {
        const {container} = renderWithContext(
            <JobTable
                {...baseProps}
                downloadExportResults={false}
            />,
        );

        // There should be ONLY 1 table element
        const tables = container.querySelectorAll('table');
        expect(tables).toHaveLength(1);

        // The table should have ONLY 1 thead element
        const theads = container.querySelectorAll('thead');
        expect(theads).toHaveLength(1);

        // The number of th tags should be equal to number of columns (5 without Files column)
        const headers = container.querySelectorAll('thead th');
        expect(headers).toHaveLength(5);

        // Verify Files column is not present
        expect(screen.queryByText('Files')).not.toBeInTheDocument();
    });

    test('hide create job button', () => {
        const {container} = renderWithContext(
            <JobTable
                {...baseProps}
                hideJobCreateButton={true}
            />,
        );

        const button = container.querySelector('button.btn-default');
        expect(button).not.toBeInTheDocument();
    });

    test('add custom class', () => {
        const {container} = renderWithContext(
            <JobTable
                {...baseProps}
                className={'job-table__data-retention'}
            />,
        );

        const element = container.querySelector('.job-table__data-retention');
        expect(element).toBeInTheDocument();
    });
});
