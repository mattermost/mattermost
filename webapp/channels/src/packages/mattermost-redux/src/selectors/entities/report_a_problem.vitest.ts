// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {getBrowserInfo} from 'mattermost-redux/utils/browser_info';

import {getReportAProblemLink, getSystemInfoMailtoLink} from './report_a_problem';

vi.mock('mattermost-redux/utils/browser_info', () => ({
    getBrowserInfo: vi.fn().mockReturnValue({browser: 'Chrome', browserVersion: '1.0.0'}),
    getPlatformInfo: vi.fn().mockReturnValue('macOS'),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getReportAProblemLink', () => {
    test('should return empty when invalid type', () => {
        const state = {
            entities: {
                general: {
                    config: {
                        ReportAProblemType: 'invalid',
                        ReportAProblemLink: 'https://example.com/report',
                        ReportAProblemMail: 'test@example.com',
                    },
                },
            },
        } as unknown as GlobalState;

        expect(getReportAProblemLink(state)).toEqual('');
    });

    test('should return the value of the link', () => {
        const state = {
            entities: {
                general: {
                    config: {
                        ReportAProblemType: 'link',
                        ReportAProblemLink: 'https://example.com/report',
                        ReportAProblemMail: 'test@example.com',
                    },
                },
            },
        } as unknown as GlobalState;

        expect(getReportAProblemLink(state)).toEqual('https://example.com/report');
        state.entities.general.config.ReportAProblemLink = 'https://example.com/new-report';
        expect(getReportAProblemLink(state)).toEqual('https://example.com/new-report');
    });

    test('should return the value of the mail', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: '123',
                },
                teams: {
                    currentTeamId: '456',
                },
                general: {
                    config: {
                        ReportAProblemType: 'email',
                        ReportAProblemLink: 'https://example.com/report',
                        ReportAProblemMail: 'test@example.com',
                        Version: '1.0.0',
                        BuildNumber: '12345',
                        SiteName: 'Example',
                    },
                },
            },
        } as unknown as GlobalState;

        const link = getReportAProblemLink(state);
        expect(link).toContain(`mailto:test@example.com?subject=${encodeURIComponent('Problem with Example app')}&body=${encodeURIComponent('System Information:')}`);
        expect(link).toContain(encodeURIComponent('- User ID: 123'));
        expect(link).toContain(encodeURIComponent('- Team ID: 456'));
        expect(link).toContain(encodeURIComponent('- Server Version: 1.0.0 (12345)'));
        expect(link).toContain(encodeURIComponent('- Browser: Chrome 1.0.0'));
        expect(link).toContain(encodeURIComponent('- Platform: macOS'));
    });

    test('should return the default value if licensed', () => {
        const state = {
            entities: {
                general: {
                    config: {
                        ReportAProblemType: 'default',
                        ReportAProblemLink: 'https://example.com/report',
                        ReportAProblemMail: 'test@example.com',
                    },
                    license: {
                        IsLicensed: 'true',
                    },
                },
            },
        } as unknown as GlobalState;

        expect(getReportAProblemLink(state)).toContain('https://mattermost.com/pl/report_a_problem_licensed');
    });

    test('should return the default value if unlicensed', () => {
        const state = {
            entities: {
                general: {
                    config: {
                        ReportAProblemType: 'default',
                        ReportAProblemLink: 'https://example.com/report',
                        ReportAProblemMail: 'test@example.com',
                    },
                    license: {
                        IsLicensed: 'false',
                    },
                },
            },
        } as unknown as GlobalState;

        expect(getReportAProblemLink(state)).toContain('https://mattermost.com/pl/report_a_problem_unlicensed');
    });
});

describe('getSystemInfoMailtoLink', () => {
    test('should return the link with the correct data', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: '123',
                },
                teams: {
                    currentTeamId: '456',
                },
                general: {
                    config: {
                        Version: '1.0.0',
                        BuildNumber: '12345',
                        SiteName: 'Example',
                    },
                },
            },
        } as unknown as GlobalState;

        const link = getSystemInfoMailtoLink(state, 'test@example.com');
        expect(link).toContain(`mailto:test@example.com?subject=${encodeURIComponent('Problem with Example app')}&body=${encodeURIComponent('System Information:')}`);
        expect(link).toContain(encodeURIComponent('- User ID: 123'));
        expect(link).toContain(encodeURIComponent('- Team ID: 456'));
        expect(link).toContain(encodeURIComponent('- Server Version: 1.0.0 (12345)'));
        expect(link).toContain(encodeURIComponent('- Browser: Chrome 1.0.0'));
        expect(link).toContain(encodeURIComponent('- Platform: macOS'));
    });

    test('should only execute once if called with the same values', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: '123',
                },
                teams: {
                    currentTeamId: '456',
                },
                general: {
                    config: {
                        Version: '1.0.0',
                        BuildNumber: '12345',
                        SiteName: 'Example',
                    },
                },
            },
        } as unknown as GlobalState;

        getSystemInfoMailtoLink(state, 'test@example1.com');
        expect(getBrowserInfo).toHaveBeenCalledTimes(1);

        getSystemInfoMailtoLink(state, 'test@example1.com');
        expect(getBrowserInfo).toHaveBeenCalledTimes(1); // No new calls

        getSystemInfoMailtoLink(state, 'test@example2.com');
        expect(getBrowserInfo).toHaveBeenCalledTimes(2);
    });
});
