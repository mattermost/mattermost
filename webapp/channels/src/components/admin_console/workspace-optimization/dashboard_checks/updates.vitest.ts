// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fetchAndCompareVersion} from './updates';

import {ItemStatus} from '../dashboard.type';

vi.mock('mattermost-redux/client', () => ({
    Client4: {
        getBaseRoute: vi.fn(() => 'http://localhost:8065/api/v4'),
    },
}));

describe('fetchAndCompareVersion', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should return major update available', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            json: vi.fn().mockResolvedValue({tag_name: 'v9.1.2', body: 'New major version available'}),
        } as unknown as Response);

        const formatMessage = vi.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('5.6.0', formatMessage);

        expect(result.type).toBe('Major');
        expect(result.description).toBe('New major version available');
        expect(result.status).toBe(ItemStatus.ERROR);
    });

    it('should return major update available - single to double digit', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            json: vi.fn().mockResolvedValue({tag_name: 'v10.0.0', body: 'New major version available'}),
        } as unknown as Response);

        const formatMessage = vi.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.1.0', formatMessage);

        expect(result.type).toBe('Major');
        expect(result.description).toBe('New major version available');
        expect(result.status).toBe(ItemStatus.ERROR);
    });

    it('should return minor update available', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            json: vi.fn().mockResolvedValue({tag_name: 'v9.2.0', body: 'New minor version available'}),
        } as unknown as Response);

        const formatMessage = vi.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.1.0', formatMessage);

        expect(result.type).toBe('Minor');
        expect(result.description).toBe('New minor version available');
        expect(result.status).toBe(ItemStatus.WARNING);
    });

    it('should return minor update available - single to double digit', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            json: vi.fn().mockResolvedValue({tag_name: 'v9.11.0', body: 'New minor version available'}),
        } as unknown as Response);

        const formatMessage = vi.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.5.0', formatMessage);

        expect(result.type).toBe('Minor');
        expect(result.description).toBe('New minor version available');
        expect(result.status).toBe(ItemStatus.WARNING);
    });

    it('should return patch update available', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            json: vi.fn().mockResolvedValue({tag_name: 'v9.1.1', body: 'New patch version available'}),
        } as unknown as Response);

        const formatMessage = vi.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.1.0', formatMessage);

        expect(result.type).toBe('Patch');
        expect(result.description).toBe('New patch version available');
        expect(result.status).toBe(ItemStatus.INFO);
    });

    it('should return patch update available - single to double digit', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            json: vi.fn().mockResolvedValue({tag_name: 'v9.1.11', body: 'New patch version available'}),
        } as unknown as Response);

        const formatMessage = vi.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.1.4', formatMessage);

        expect(result.type).toBe('Patch');
        expect(result.description).toBe('New patch version available');
        expect(result.status).toBe(ItemStatus.INFO);
    });

    it('should return no update available', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            json: vi.fn().mockResolvedValue({tag_name: 'v9.1.0', body: 'No new version available'}),
        } as unknown as Response);

        const formatMessage = vi.fn(({defaultMessage}) => defaultMessage);
        const result = await fetchAndCompareVersion('9.1.0', formatMessage);

        expect(result.type).toBe('');
        expect(result.description).toBe('No new version available');
        expect(result.status).toBe(ItemStatus.OK);
    });
});
