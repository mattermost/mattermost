// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';

import useMetricsData from './dashboard.data';

describe('useMetricsData - Server updates section', () => {
    const latestVersionCalls = () => (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).endsWith('/latest_version'));

    const renderMetrics = async (config: Partial<AdminConfig>) => {
        const {result} = renderHookWithContext(() => useMetricsData(config), {
            entities: {general: {serverVersion: '9.1.0', license: {IsLicensed: 'false'}}},
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        return result.current.data!;
    };

    beforeEach(() => {
        const latestRelease = {tag_name: 'v9.2.0', body: 'New minor version available'};
        global.fetch = jest.fn().mockImplementation(async () => ({
            ok: true,
            status: 200,
            headers: new Headers({'Content-Type': 'application/json'}),
            json: async () => latestRelease,
            text: async () => JSON.stringify(latestRelease),
        }));
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    test('shows the section and checks the latest release when EnableSecurityFixAlert is on', async () => {
        const data = await renderMetrics({ServiceSettings: {EnableSecurityFixAlert: true}} as Partial<AdminConfig>);

        expect(data.updates.hide).toBe(false);
        expect(data.updates.items).toHaveLength(1);
        expect(latestVersionCalls()).toHaveLength(1);
    });

    test('hides the section without checking the latest release when EnableSecurityFixAlert is off', async () => {
        const data = await renderMetrics({ServiceSettings: {EnableSecurityFixAlert: false}} as Partial<AdminConfig>);

        expect(data.updates.hide).toBe(true);
        expect(data.updates.items).toEqual([]);
        expect(latestVersionCalls()).toHaveLength(0);
    });
});
