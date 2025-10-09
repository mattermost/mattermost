// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, memo} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getUser} from 'mattermost-redux/selectors/entities/users';

import AiIcon from 'components/widgets/icons/ai_icon';
import WithTooltip from 'components/with_tooltip';

import type {GlobalState} from 'types/store';

type Props = {
    userId: string;
    postAuthorId: string;
};

function AiGeneratedIndicator({userId, postAuthorId}: Props) {
    const intl = useIntl();
    const user = useSelector((state: GlobalState) => getUser(state, userId));

    const tooltipText = useMemo(() => {
        const isSameAsAuthor = userId === postAuthorId;

        if (isSameAsAuthor) {
            return intl.formatMessage({
                id: 'post_info.ai_generated.self',
                defaultMessage: 'AI-generated',
            });
        }

        const username = user?.username || intl.formatMessage({
            id: 'post_info.ai_generated.unknown_user',
            defaultMessage: 'Unknown User',
        });

        return intl.formatMessage(
            {
                id: 'post_info.ai_generated.by_user',
                defaultMessage: 'Message posted by @{username}',
            },
            {username},
        );
    }, [userId, postAuthorId, user?.username, intl]);

    return (
        <WithTooltip title={tooltipText}>
            <span
                className='ai-generated-indicator'
                aria-label={tooltipText}
            >
                <AiIcon/>
            </span>
        </WithTooltip>
    );
}

export default memo(AiGeneratedIndicator);
