// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';

import type Timestamp from './timestamp';

export const fullDateTimeTooltipDateFormat: ComponentProps<typeof Timestamp>['useDate'] = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
};

export const fullDateTimeTooltipTimeFormat: ComponentProps<typeof Timestamp>['useTime'] = (_, {hour, minute, second}) => ({
    hour,
    minute,
    second,
});
