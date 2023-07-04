// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import DatabaseSettings from 'components/admin_console/database_settings';

jest.mock('actions/admin_actions.jsx', () => {
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
    test('should match snapshot', () => {
        const props = {
            ...baseProps,
            value: [],
        };
        const config = {
            SqlSettings: {
                MaxIdleConns: 10,
                MaxOpenConns: 100,
                Trace: false,
                DisableDatabaseSearch: true,
                DataSource: 'postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable\u0026connect_timeout=10',
                QueryTimeout: 10,
                ConnMaxLifetimeMilliseconds: 10,
                ConnMaxIdleTimeMilliseconds: 20,
            },
            ServiceSettings: {
                MinimumHashtagLength: 10,
            },
        };
        const wrapper = shallow(
            <DatabaseSettings
                {...props}
                config={config}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
