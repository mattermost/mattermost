// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginsState} from './plugins';
import type {ViewsState} from './views';
import type {GlobalState as BaseGlobalState} from '@mattermost/types/store';

export type DraggingState = {
    state?: string;
    type?: string;
    id?: string;
}

export type GlobalState = BaseGlobalState & {
    plugins: PluginsState;
    storage: {
        storage: Record<string, any>;
        initialized: boolean;
    };
    views: ViewsState;
};
