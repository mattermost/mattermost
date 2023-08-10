// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type Timestamp from 'components/timestamp';
import type {ComponentProps} from 'react';

export const THREADING_TIME: Partial<ComponentProps<typeof Timestamp>> = {
    units: [
        'now',
        'minute',
        'hour',
        'day',
        'week',
    ],
    useTime: false,
    day: 'numeric',
};
