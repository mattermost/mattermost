// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {applyIntegrationGotoLocation} from './integration_navigation';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: jest.fn()}),
}));

jest.mock('utils/url', () => ({
    getSiteURL: () => 'https://mattermost.example.com',
    isUrlSafe: (url: string) => url.startsWith('https://'),
}));

describe('applyIntegrationGotoLocation', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    beforeEach(() => {
        openSpy.mockClear();
    });

    afterAll(() => {
        openSpy.mockRestore();
    });

    it('opens external urls with noopener and noreferrer', () => {
        applyIntegrationGotoLocation('https://external.example.com/path');
        expect(openSpy).toHaveBeenCalledWith(
            'https://external.example.com/path',
            '_blank',
            'noopener,noreferrer',
        );
    });
});
