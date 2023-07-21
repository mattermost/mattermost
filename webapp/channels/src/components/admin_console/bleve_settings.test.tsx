// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminConfig} from '@mattermost/types/config';
import {shallow} from 'enzyme';
import React from 'react';

import BleveSettings from 'components/admin_console/bleve_settings';

jest.mock('actions/admin_actions.jsx', () => {
    return {
        blevePurgeIndexes: jest.fn(),
    };
});

describe('components/BleveSettings', () => {
    test('should match snapshot, disabled', () => {
        const config = {
            BleveSettings: {
                IndexDir: '',
                EnableIndexing: false,
                EnableSearching: false,
                EnableAutocomplete: false,
            },
        } as AdminConfig;
        const wrapper = shallow(
            <BleveSettings
                config={config}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, enabled', () => {
        const config = {
            BleveSettings: {
                IndexDir: 'bleve.idx',
                EnableIndexing: true,
                EnableSearching: false,
                EnableAutocomplete: false,
            },
        } as AdminConfig;
        const wrapper = shallow(
            <BleveSettings
                config={config}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
