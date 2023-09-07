// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

export const emptyLimits: () => GlobalState['entities']['cloud']['limits'] = () => ({
    limitsLoaded: true,
    limits: {},
});
