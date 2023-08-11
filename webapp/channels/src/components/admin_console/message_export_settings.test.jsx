// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import MessageExportSettings from 'components/admin_console/message_export_settings.jsx';

describe('components/MessageExportSettings', () => {
    test('should match snapshot, disabled, actiance', () => {
        const config = {
            MessageExportSettings: {
                EnableExport: false,
                ExportFormat: 'actiance',
                DailyRunTime: '01:00',
                ExportFromTimestamp: null,
                BatchSize: 10000,
            },
        };

        const wrapper = shallow(
            <MessageExportSettings
                config={config}
            />,
        );
        expect(wrapper).toMatchSnapshot();

        // actiance config fields are disabled
        expect(wrapper.find('#exportJobStartTime').prop('disabled')).toBe(true);
        expect(wrapper.find('#exportFormat').prop('disabled')).toBe(true);

        // globalrelay config fiels are not rendered
        expect(wrapper.find('#globalRelaySettings').exists()).toBe(false);

        // controls should reflect config
        expect(wrapper.find('#enableComplianceExport').prop('value')).toBe(false);
        expect(wrapper.find('#exportJobStartTime').prop('value')).toBe('01:00');
        expect(wrapper.find('#exportFormat').prop('value')).toBe('actiance');
    });

    test('should match snapshot, enabled, actiance', () => {
        const config = {
            MessageExportSettings: {
                EnableExport: true,
                ExportFormat: 'actiance',
                DailyRunTime: '01:00',
                ExportFromTimestamp: 12345678,
                BatchSize: 10000,
            },
        };

        const wrapper = shallow(
            <MessageExportSettings
                config={config}
            />,
        );
        expect(wrapper).toMatchSnapshot();

        // actiance config fields are enabled
        expect(wrapper.find('#exportJobStartTime').prop('disabled')).toBe(false);
        expect(wrapper.find('#exportFormat').prop('disabled')).toBe(false);

        // globalrelay config fiels are not rendered
        expect(wrapper.find('#globalRelaySettings').exists()).toBe(false);

        // controls should reflect config
        expect(wrapper.find('#enableComplianceExport').prop('value')).toBe(true);
        expect(wrapper.find('#exportJobStartTime').prop('value')).toBe('01:00');
        expect(wrapper.find('#exportFormat').prop('value')).toBe('actiance');
    });

    test('should match snapshot, disabled, globalrelay', () => {
        const config = {
            MessageExportSettings: {
                EnableExport: false,
                ExportFormat: 'globalrelay',
                DailyRunTime: '01:00',
                ExportFromTimestamp: 12345678,
                BatchSize: 10000,
                GlobalRelaySettings: {
                    CustomerType: 'A10',
                    SMTPUsername: 'globalRelayUser',
                    SMTPPassword: 'globalRelayPassword',
                    EmailAddress: 'globalRelay@mattermost.com',
                },
            },
        };

        const wrapper = shallow(
            <MessageExportSettings
                config={config}
            />,
        );
        expect(wrapper).toMatchSnapshot();

        // actiance config fields are disabled
        expect(wrapper.find('#exportJobStartTime').prop('disabled')).toBe(true);
        expect(wrapper.find('#exportFormat').prop('disabled')).toBe(true);

        // globalrelay config fiels are disabled
        expect(wrapper.find('#globalRelayCustomerType').prop('disabled')).toBe(true);
        expect(wrapper.find('#globalRelaySMTPUsername').prop('disabled')).toBe(true);
        expect(wrapper.find('#globalRelaySMTPPassword').prop('disabled')).toBe(true);
        expect(wrapper.find('#globalRelayEmailAddress').prop('disabled')).toBe(true);

        // controls should reflect config
        expect(wrapper.find('#enableComplianceExport').prop('value')).toBe(false);
        expect(wrapper.find('#exportJobStartTime').prop('value')).toBe('01:00');
        expect(wrapper.find('#exportFormat').prop('value')).toBe('globalrelay');
        expect(wrapper.find('#globalRelayCustomerType').prop('value')).toBe('A10');
        expect(wrapper.find('#globalRelaySMTPUsername').prop('value')).toBe('globalRelayUser');
        expect(wrapper.find('#globalRelaySMTPPassword').prop('value')).toBe('globalRelayPassword');
        expect(wrapper.find('#globalRelayEmailAddress').prop('value')).toBe('globalRelay@mattermost.com');
    });

    test('should match snapshot, enabled, globalrelay', () => {
        const config = {
            MessageExportSettings: {
                EnableExport: true,
                ExportFormat: 'globalrelay',
                DailyRunTime: '01:00',
                ExportFromTimestamp: 12345678,
                BatchSize: 10000,
                GlobalRelaySettings: {
                    CustomerType: 'A10',
                    SMTPUsername: 'globalRelayUser',
                    SMTPPassword: 'globalRelayPassword',
                    EmailAddress: 'globalRelay@mattermost.com',
                },
            },
        };

        const wrapper = shallow(
            <MessageExportSettings
                config={config}
            />,
        );
        expect(wrapper).toMatchSnapshot();

        // actiance config fields are enabled
        expect(wrapper.find('#exportJobStartTime').prop('disabled')).toBe(false);
        expect(wrapper.find('#exportFormat').prop('disabled')).toBe(false);

        // globalrelay config fiels are enabled
        expect(wrapper.find('#globalRelayCustomerType').prop('disabled')).toBe(false);
        expect(wrapper.find('#globalRelaySMTPUsername').prop('disabled')).toBe(false);
        expect(wrapper.find('#globalRelaySMTPPassword').prop('disabled')).toBe(false);
        expect(wrapper.find('#globalRelayEmailAddress').prop('disabled')).toBe(false);

        // controls should reflect config
        expect(wrapper.find('#enableComplianceExport').prop('value')).toBe(true);
        expect(wrapper.find('#exportJobStartTime').prop('value')).toBe('01:00');
        expect(wrapper.find('#exportFormat').prop('value')).toBe('globalrelay');
        expect(wrapper.find('#globalRelayCustomerType').prop('value')).toBe('A10');
        expect(wrapper.find('#globalRelaySMTPUsername').prop('value')).toBe('globalRelayUser');
        expect(wrapper.find('#globalRelaySMTPPassword').prop('value')).toBe('globalRelayPassword');
        expect(wrapper.find('#globalRelayEmailAddress').prop('value')).toBe('globalRelay@mattermost.com');
    });
});

describe('components/MessageExportSettings/getJobDetails', () => {
    const baseProps = {
        config: {
            MessageExportSettings: {
                EnableExport: true,
                ExportFormat: 'actiance',
                DailyRunTime: '01:00',
                ExportFromTimestamp: 12345678,
                BatchSize: 10000,
            },
        },
    };

    const wrapper = shallow(<MessageExportSettings {...baseProps}/>);

    function runTest(testJob, expectNull, expectedCount) {
        const jobDetails = wrapper.instance().getJobDetails(testJob);
        if (expectNull) {
            expect(jobDetails).toBe(null);
        } else {
            expect(jobDetails.length).toBe(expectedCount);
        }
    }

    const job = {};
    test('test no data', () => {
        runTest(job, true, 0);
    });

    test('test success message, missing warnings', () => {
        job.data = {
            messages_exported: 3,
        };
        runTest(job, false, 1);
    });

    test('test success message, 0 warnings', () => {
        job.data = {
            messages_exported: 3,
            warning_count: 0,
        };
        runTest(job, false, 1);
    });

    test('test warning message', () => {
        job.data = {
            messages_exported: 3,
            warning_count: 2,
        };
        runTest(job, false, 2);
    });
});
