// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import type {FC} from 'react';

import Timestamp, {RelativeRanges} from 'components/timestamp';
import BasicSeparator from 'components/widgets/separator/basic-separator';

const DATE_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.YESTERDAY_TITLE_CASE,
];

type Props = {
    date: number | Date;

    // The list's date line, e.g. `center.post_list.date_separator`.
    testId?: string;
};

const DateSeparator: FC<Props> = ({date, testId}) => {
    return (
        <BasicSeparator testId={testId}>
            <Timestamp
                value={date}
                useTime={false}
                useSemanticOutput={false}
                ranges={DATE_RANGES}
            />
        </BasicSeparator>
    );
};

export default memo(DateSeparator);
