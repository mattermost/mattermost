// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {getBrowserInfo} from 'mattermost-redux/utils/browser_info';

import {getDefaultReportAProblemMailtoLink, getReportAProblemLink, getSystemInfoMailtoLink} from './report_a_problem';

jest.mock('mattermost-redux/utils/browser_info', () => ({
    getBrowserInfo: jest.fn().mockReturnValue({browser: 'Chrome', browserVersion: '1.0.0'}),
    getPlatformInfo: jest.fn().mockReturnValue('macOS'),
    isDesktopApp: jest.fn().mockReturnValue(false),
    getDesktopVersion: jest.fn().mockReturnValue(''),
}));

describe('getReportAProblemLink', () => {
    it('should return empty when invalid type', () => {
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

    it('should return the value of the link', () => {
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

    it('should return the value of the mail', () => {
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

    it('should return a mailto link to reportaproblem@mattermost.com if licensed with a paid SKU', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'user1',
                },
                teams: {
                    currentTeamId: 'team1',
                },
                general: {
                    config: {
                        ReportAProblemType: 'default',
                        ReportAProblemLink: 'https://example.com/report',
                        ReportAProblemMail: 'test@example.com',
                        Version: '10.0.0',
                        BuildNumber: '99999',
                    },
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: 'professional',
                    },
                },
            },
        } as unknown as GlobalState;

        const link = getReportAProblemLink(state);
        expect(link).toContain('mailto:reportaproblem@mattermost.com');
        expect(link).toContain(encodeURIComponent('Problem with Mattermost app'));
        expect(link).toContain(encodeURIComponent('Current User Id: user1'));
        expect(link).toContain(encodeURIComponent('Current Team Id: team1'));
        expect(link).toContain(encodeURIComponent('Server Version: 10.0.0 (Build 99999)'));
        expect(link).toContain(encodeURIComponent('App Platform: macOS'));
    });

    it('should return the default unlicensed URL if unlicensed', () => {
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

    it('should return the default unlicensed URL if licensed with entry SKU', () => {
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
                        SkuShortName: 'entry',
                    },
                },
            },
        } as unknown as GlobalState;

        expect(getReportAProblemLink(state)).toContain('https://mattermost.com/pl/report_a_problem_unlicensed');
    });
});

describe('getDefaultReportAProblemMailtoLink', () => {
    const baseState = {
        entities: {
            users: {
                currentUserId: 'user1',
            },
            teams: {
                currentTeamId: 'team1',
            },
            general: {
                config: {
                    Version: '10.0.0',
                    BuildNumber: '99999',
                },
            },
        },
    } as unknown as GlobalState;

    it('should include correct metadata in the email body', () => {
        const link = getDefaultReportAProblemMailtoLink(baseState);
        expect(link).toContain('mailto:reportaproblem@mattermost.com');
        expect(link).toContain(encodeURIComponent('Problem with Mattermost app'));
        expect(link).toContain(encodeURIComponent('Current User Id: user1'));
        expect(link).toContain(encodeURIComponent('Current Team Id: team1'));
        expect(link).toContain(encodeURIComponent('Server Version: 10.0.0 (Build 99999)'));
        expect(link).toContain(encodeURIComponent('App Platform: macOS'));
    });

    it('should include a link to the browser console logs help article when not on desktop app', () => {
        const link = getDefaultReportAProblemMailtoLink(baseState);
        expect(link).toContain(encodeURIComponent('browser console logs (https://support.mattermost.com/hc/en-us/articles/35971622382484)'));
    });

    it('should include a link to the desktop logs help article when on desktop app', () => {
        const {isDesktopApp: mockIsDesktopApp, getDesktopVersion: mockGetDesktopVersion} = jest.requireMock('mattermost-redux/utils/browser_info');
        mockIsDesktopApp.mockReturnValue(true);
        mockGetDesktopVersion.mockReturnValue('5.10.0');

        // Use different state to invalidate selector cache
        const desktopState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                users: {currentUserId: 'user-desktop-logs'},
            },
        } as unknown as GlobalState;

        const link = getDefaultReportAProblemMailtoLink(desktopState);
        expect(link).toContain(encodeURIComponent('desktop app logs (https://support.mattermost.com/hc/en-us/articles/37269786544916)'));

        // Reset mock
        mockIsDesktopApp.mockReturnValue(false);
    });

    it('should NOT include Desktop Version line when not on desktop app', () => {
        const {isDesktopApp: mockIsDesktopApp} = jest.requireMock('mattermost-redux/utils/browser_info');
        mockIsDesktopApp.mockReturnValue(false);

        const link = getDefaultReportAProblemMailtoLink(baseState);
        expect(link).not.toContain(encodeURIComponent('Desktop Version:'));
    });

    it('should include Desktop Version line when running in the desktop app', () => {
        const {isDesktopApp: mockIsDesktopApp, getDesktopVersion: mockGetDesktopVersion} = jest.requireMock('mattermost-redux/utils/browser_info');
        mockIsDesktopApp.mockReturnValue(true);
        mockGetDesktopVersion.mockReturnValue('5.10.0');

        const stateWithDifferentUser = {
            ...baseState,
            entities: {
                ...baseState.entities,
                users: {currentUserId: 'user2'},
            },
        } as unknown as GlobalState;

        const link = getDefaultReportAProblemMailtoLink(stateWithDifferentUser);
        expect(link).toContain(encodeURIComponent('Desktop Version: 5.10.0'));
    });
});

describe('getSystemInfoMailtoLink', () => {
    it('should return the link with the correct data', () => {
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

    it('should only execute once if called with the same values', () => {
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
