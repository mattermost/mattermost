// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {vi} from 'vitest';

// Mock mattermost-redux store to avoid require() issues with configureStore
// This mock provides the actual configureStore implementation directly
vi.mock('mattermost-redux/store', async () => {
    const actual = await vi.importActual<typeof import('packages/mattermost-redux/src/store/configureStore')>('packages/mattermost-redux/src/store/configureStore');
    return {
        default: actual.default,
    };
});
