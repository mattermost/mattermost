// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React, {memo} from 'react';
import type {FC} from 'react';

import Timestamp, {RelativeRanges} from 'components/timestamp';

import PostSeparator from 'design_system/components/patterns/post_separator';

const DATE_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.YESTERDAY_TITLE_CASE,
];

type Props = {
    date: number | Date;
}

const DateSeparator: FC<Props> = ({date}) => {
    return (
        <PostSeparator testId='basicSeparator'>
            <Timestamp
                value={date}
                useTime={false}
                useSemanticOutput={false}
                ranges={DATE_RANGES}
            />
        </PostSeparator>
    );
};

DateSeparator.propTypes = {
    date: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.instanceOf(Date),
    ]).isRequired,
};

export default memo(DateSeparator);
