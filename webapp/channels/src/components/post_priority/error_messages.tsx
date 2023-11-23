// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage, FormattedList} from 'react-intl';

export function HasSpecialMentions({specialMentions}: {specialMentions: {[key: string]: boolean}}) {
    const mentions = useMemo(() => {
        return Object.keys(specialMentions).
            filter((key) => specialMentions[key]).
            map((key) => `@${key}`);

        /* eslint-disable react-hooks/exhaustive-deps */
    }, [
        specialMentions.all,
        specialMentions.here,
        specialMentions.channel,
    ]);
    /* eslint-enable react-hooks/exhaustive-deps */

    return (
        <FormattedMessage
            id={'post_priority.error.special_mentions'}
            defaultMessage={'{mention} can’t be used with persistent notifications'}
            values={{
                mention: (
                    <FormattedList
                        value={mentions}
                        type='disjunction'
                    />
                ),
            }}
        />
    );
}

export function HasNoMentions() {
    return (
        <FormattedMessage
            id={'post_priority.error.no_mentions'}
            defaultMessage={'Recipients must be @mentioned'}
        />
    );
}
