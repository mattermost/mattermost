// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Mock for useRemoteClusters hook
jest.mock('components/admin_console/secure_connections/utils', () => {
    // Keep original implementation for utility functions
    const originalModule = jest.requireActual('components/admin_console/secure_connections/utils');
    
    return {
        ...originalModule,
        useRemoteClusters: jest.fn(() => {
            return [undefined, {loading: false, fetch: jest.fn(), error: undefined}];
        }),
    };
});