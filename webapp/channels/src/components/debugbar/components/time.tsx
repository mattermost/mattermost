// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo} from 'react';
import {DateTime} from 'luxon';

type Props = {
    time: number;
}

function Time({time}: Props) {
    const dt = useMemo(() => DateTime.fromMillis(time), [time]);

    return (
        <i title={dt.toISO()}>
            {dt.toFormat('HH:MM:ss:SSS')}
        </i>
    );
}

export default memo(Time);
