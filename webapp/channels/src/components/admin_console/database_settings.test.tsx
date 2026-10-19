// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import DatabaseSettings from 'components/admin_console/database_settings';

import {renderWithContext, screen} from 'tests/react_testing_utils';

jest.mock('actions/admin_actions', () => {
    const pingFn = () => {
        return jest.fn(() => {
            return {ActiveSearchBackend: 'none'};
        });
    };
    return {
        recycleDatabaseConnection: jest.fn(),
        ping: pingFn,
    };
});

describe('components/DatabaseSettings', () => {
    const baseProps = {
        license: {
            IsLicensed: 'true',
            Cluster: 'true',
        },
    };

    const config = {
        SqlSettings: {
            MaxIdleConns: 10,
            MaxOpenConns: 100,
            Trace: false,
            DisableDatabaseSearch: true,
            DataSource: 'postgres://mmuser:mostest_password@localhost/mattermost_test?sslmode=disable\u0026connect_timeout=10',
            QueryTimeout: 10,
            AnalyticsQueryTimeout: 300,
            ConnMaxLifetimeMilliseconds: 10,
            ConnMaxIdleTimeMilliseconds: 20,
        },
        ServiceSettings: {
            MinimumHashtagLength: 10,
        },
    };

    test('should match snapshot', () => {
        const props = {
            ...baseProps,
            value: [],
            config,
            isDisabled: false,
        };
        const {container} = renderWithContext(
            <DatabaseSettings
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('renders numeric SQL settings as native type=number Compass inputs', () => {
        const {container} = renderWithContext(
            <DatabaseSettings
                {...baseProps}
                value={[]}
                config={config}
                isDisabled={false}
            />,
        );

        const numberIds = [
            'maxIdleConns',
            'maxOpenConns',
            'queryTimeout',
            'analyticsQueryTimeout',
            'connMaxLifetimeMilliseconds',
            'connMaxIdleTimeMilliseconds',
            'minimumHashtagLength',
        ];

        for (const id of numberIds) {
            const input = screen.getByTestId(`${id}number`);
            expect(input).toHaveAttribute('type', 'number');
            expect(input).toHaveAttribute('id', id);
            expect(input).not.toHaveClass('form-control');

            // Left-column Setting label owns the name — no floating Compass legend
            // on these number fields (useLegend={false}).
            const fieldRoot = input.closest('.Input_container');
            expect(fieldRoot).toBeInTheDocument();
            expect(fieldRoot!.querySelector('legend')).not.toBeInTheDocument();
        }

        expect(container.querySelectorAll('.Input_container').length).toBeGreaterThanOrEqual(numberIds.length);
    });
});
