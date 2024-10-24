// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import ElasticSearchSettings from 'components/admin_console/elasticsearch_settings';
import SaveButton from 'components/save_button';

jest.mock('actions/admin_actions.jsx', () => {
    return {
        elasticsearchPurgeIndexes: jest.fn(),
        rebuildChannelsIndex: jest.fn(),
        elasticsearchTest: (config: AdminConfig, success: () => void) => success(),
    };
});

describe('components/ElasticSearchSettings', () => {
    test('should match snapshot, disabled', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
                SkipTLSVerification: false,
                CA: 'test.ca',
                ClientCert: 'test.crt',
                ClientKey: 'test.key',
                Username: 'test',
                Password: 'test',
                Sniff: false,
                EnableIndexing: false,
                EnableSearching: false,
                EnableAutocomplete: false,
            },
        };
        const wrapper = shallow(
            <ElasticSearchSettings
                config={config as AdminConfig}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, enabled', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
                SkipTLSVerification: false,
                CA: 'test.ca',
                ClientCert: 'test.crt',
                ClientKey: 'test.key',
                Username: 'test',
                Password: 'test',
                Sniff: false,
                EnableIndexing: true,
                EnableSearching: false,
                EnableAutocomplete: false,
            },
        };
        const wrapper = shallow(
            <ElasticSearchSettings
                config={config as AdminConfig}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should maintain save disable until is tested', () => {
        const config = {
            ElasticsearchSettings: {
                ConnectionURL: 'test',
                SkipTLSVerification: false,
                Username: 'test',
                Password: 'test',
                Sniff: false,
                EnableIndexing: false,
                EnableSearching: false,
                EnableAutocomplete: false,
            },
        };
        const wrapper = shallow(
            <ElasticSearchSettings
                config={config as AdminConfig}
            />,
        );
        const instance = wrapper.instance() as any;
        expect(wrapper.find(SaveButton).prop('disabled')).toBe(true);
        instance.handleSettingChanged('enableIndexing', true);
        expect(wrapper.find(SaveButton).prop('disabled')).toBe(true);
        const success = jest.fn();
        const error = jest.fn();
        instance.doTestConfig(success, error);
        expect(success).toBeCalled();
        expect(error).not.toBeCalled();
        expect(wrapper.find(SaveButton).prop('disabled')).toBe(false);
    });
});
