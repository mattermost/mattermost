// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {vi} from 'vitest';

(global as any).historyMock = {
    length: -1,
    action: 'PUSH',
    location: {
        pathname: '/a-mocked-location',
        search: '',
        hash: '',
    },
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    block: vi.fn(),
    listen: vi.fn(),
    createHref: vi.fn(),
};

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

    return {
        ...actual,
        useHistory: () => (global as any).historyMock,
    };
});

vi.mock('utils/browser_history', () => {
    return {
        getHistory: () => (global as any).historyMock,
    };
});

export {};
