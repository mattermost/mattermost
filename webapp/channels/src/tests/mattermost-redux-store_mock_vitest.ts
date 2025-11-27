// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {vi} from 'vitest';

// Mock mattermost-redux store to avoid require() issues
vi.mock('mattermost-redux/store', () => ({
    default: vi.fn(() => ({
        dispatch: vi.fn(),
        getState: vi.fn(() => ({})),
        subscribe: vi.fn(),
        replaceReducer: vi.fn(),
    })),
}));
