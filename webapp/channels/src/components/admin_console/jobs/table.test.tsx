// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {shallow} from 'enzyme';

import JobTable, {Props} from './table';
import JobCancelButton from './job_cancel_button';

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
    const cancelJob = jest.fn(() => Promise.resolve({}));
    const createJob = jest.fn(() => Promise.resolve({}));
    const getJobsByType = jest.fn(() => Promise.resolve({}));

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
            id: '1236',
            status: 'warning',
            type: 'data_retention',
            priority: 0,
            start_at: 0,
            progress: 0,
            data: '',
        }],
    };

    test('should call create job func', () => {
        const wrapper = shallow(
            <JobTable {...baseProps}/>,
        );

        wrapper.find('.job-table__create-button > div > .btn-tertiary').simulate('click', {preventDefault: jest.fn()});
        expect(createJob).toHaveBeenCalledTimes(1);
    });

    test('should call cancel job func', () => {
        const wrapper = shallow(
            <JobTable {...baseProps}/>,
        );

        wrapper.find(JobCancelButton).first().simulate('click', {preventDefault: jest.fn(), currentTarget: {getAttribute: () => '1234'}});
        expect(cancelJob).toHaveBeenCalledTimes(1);
    });

    test('files column should show', () => {
        const cols = [
            {header: ''},
            {header: 'Status'},
            {header: 'Files'},
            {header: 'Finish Time'},
            {header: 'Run Time'},
            {header: 'Details'},
        ];

        const wrapper = shallow(
            <JobTable
                {...baseProps}
                jobType='message_export'
                downloadExportResults={true}
            />,
        );

        // There should be ONLY 1 table element
        const table = wrapper.find('table');
        expect(table).toHaveLength(1);

        // The table should have ONLY 1 thead element
        const thead = table.find('thead');
        expect(thead).toHaveLength(1);

        // The number of th tags should be equal to number of columns
        const headers = thead.find('th');
        expect(headers).toHaveLength(cols.length);
    });

    test('files column should not show', () => {
        const cols = [
            {header: ''},
            {header: 'Status'},
            {header: 'Finish Time'},
            {header: 'Run Time'},
            {header: 'Details'},
        ];

        const wrapper = shallow(
            <JobTable
                {...baseProps}
                downloadExportResults={false}
            />,
        );

        // There should be ONLY 1 table element
        const table = wrapper.find('table');
        expect(table).toHaveLength(1);

        // The table should have ONLY 1 thead element
        const thead = table.find('thead');
        expect(thead).toHaveLength(1);

        // The number of th tags should be equal to number of columns
        const headers = thead.find('th');
        expect(headers).toHaveLength(cols.length);
    });

    test('hide create job button', () => {
        const wrapper = shallow(
            <JobTable
                {...baseProps}
                hideJobCreateButton={true}
            />,
        );

        const button = wrapper.find('button.btn-default');
        expect(button).toHaveLength(0);
    });

    test('add custom class', () => {
        const wrapper = shallow(
            <JobTable
                {...baseProps}
                className={'job-table__data-retention'}
            />,
        );

        const element = wrapper.find('.job-table__data-retention');
        expect(element).toHaveLength(1);
    });
});
