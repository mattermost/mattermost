// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import './rank_badge.scss';

type Props = {
    rank?: number;
    className?: string;
};

// A small numbered badge shown in front of a ranked option's label. The number
// is programmatically labeled so it is not conveyed by position/color alone
// (WCAG 1.3.1 / 1.4.1).
const RankBadge = ({rank, className}: Props) => {
    const {formatMessage} = useIntl();

    if (rank === undefined || rank === null) {
        return null;
    }

    return (
        <span
            className={classNames('rank-badge', className)}
            data-testid='rank-badge'
            aria-label={formatMessage({
                id: 'admin.system_properties.user_properties.rank_badge.aria_label',
                defaultMessage: 'Rank {rank}',
            }, {rank})}
        >
            {rank}
        </span>
    );
};

export default RankBadge;
