// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {fetchAndCompareVersion, runUpdateChecks} from './updates';

import {ItemStatus} from '../dashboard.type';
import type {Options} from '../dashboard.type';

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getBaseRoute: jest.fn(() => 'http://localhost/api/v4'),
    },
}));

describe('fetchAndCompareVersion', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it('should return major update available', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: jest.fn().mockResolvedValue({tag_name: 'v9.1.2', body: 'New major version available'}),
        });

        const formatMessage = jest.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('5.6.0', formatMessage);

        expect(result.type).toBe('Major');
        expect(result.description).toBe('New major version available');
        expect(result.status).toBe(ItemStatus.ERROR);
    });

    it('should return major update available - single to double digit', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: jest.fn().mockResolvedValue({tag_name: 'v10.0.0', body: 'New major version available'}),
        });

        const formatMessage = jest.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.1.0', formatMessage);

        expect(result.type).toBe('Major');
        expect(result.description).toBe('New major version available');
        expect(result.status).toBe(ItemStatus.ERROR);
    });

    it('should return minor update available', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: jest.fn().mockResolvedValue({tag_name: 'v9.2.0', body: 'New minor version available'}),
        });

        const formatMessage = jest.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.1.0', formatMessage);

        expect(result.type).toBe('Minor');
        expect(result.description).toBe('New minor version available');
        expect(result.status).toBe(ItemStatus.WARNING);
    });

    it('should return minor update available - single to double digit', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: jest.fn().mockResolvedValue({tag_name: 'v9.11.0', body: 'New minor version available'}),
        });

        const formatMessage = jest.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.5.0', formatMessage);

        expect(result.type).toBe('Minor');
        expect(result.description).toBe('New minor version available');
        expect(result.status).toBe(ItemStatus.WARNING);
    });

    it('should return patch update available', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: jest.fn().mockResolvedValue({tag_name: 'v9.1.1', body: 'New patch version available'}),
        });

        const formatMessage = jest.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.1.0', formatMessage);

        expect(result.type).toBe('Patch');
        expect(result.description).toBe('New patch version available');
        expect(result.status).toBe(ItemStatus.INFO);
    });

    it('should return patch update available - single to double digit', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: jest.fn().mockResolvedValue({tag_name: 'v9.1.11', body: 'New patch version available'}),
        });

        const formatMessage = jest.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.1.4', formatMessage);

        expect(result.type).toBe('Patch');
        expect(result.description).toBe('New patch version available');
        expect(result.status).toBe(ItemStatus.INFO);
    });

    it('should return no update available', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            json: jest.fn().mockResolvedValue({tag_name: 'v9.1.0', body: 'No new version available'}),
        });

        const formatMessage = jest.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.1.0', formatMessage);

        expect(result.type).toBe('');
        expect(result.description).toBe('No new version available');
        expect(result.status).toBe(ItemStatus.OK);
    });
});

describe('runUpdateChecks', () => {
    const options = {installedVersion: '9.1.0'} as Options;
    const configWithSecurityFixAlert = (enabled: boolean) => ({ServiceSettings: {EnableSecurityFixAlert: enabled}} as Partial<AdminConfig>);

    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn().mockResolvedValue({tag_name: 'v9.2.0', body: 'New minor version available'}),
        });
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it('should report the latest release when EnableSecurityFixAlert is on', async () => {
        const formatMessage = jest.fn(({defaultMessage}) => defaultMessage);
        const results = await runUpdateChecks(configWithSecurityFixAlert(true), formatMessage, options);

        expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/latest_version$/));
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('{type} version update available.');
        expect(results[0].description).toBe('New minor version available');
        expect(results[0].status).toBe(ItemStatus.WARNING);
    });

    it('should report the latest release when EnableSecurityFixAlert is not readable', async () => {
        const formatMessage = jest.fn(({defaultMessage}) => defaultMessage);
        const results = await runUpdateChecks({}, formatMessage, options);

        expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/latest_version$/));
        expect(results).toHaveLength(1);
    });

    it('should skip the latest release check when EnableSecurityFixAlert is off', async () => {
        const formatMessage = jest.fn(({defaultMessage}) => defaultMessage);
        const results = await runUpdateChecks(configWithSecurityFixAlert(false), formatMessage, options);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(results).toEqual([]);
    });
});
