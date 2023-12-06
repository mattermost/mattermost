// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

(global as any).historyMock = {
    length: -1,
    action: 'PUSH',
    location: {
        pathname: '/a-mocked-location',
        search: '',
        hash: '',
    },
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    block: jest.fn(),
    listen: jest.fn(),
    createHref: jest.fn(),
};

jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');

    return {
        ...actual,
        useHistory: () => (global as any).historyMock,
    };
});

jest.mock('utils/browser_history', () => {
    return {
        getHistory: () => (global as any).historyMock,
    };
});

export {};
