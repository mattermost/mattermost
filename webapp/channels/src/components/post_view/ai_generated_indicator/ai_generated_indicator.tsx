// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, memo} from 'react';
import {useIntl} from 'react-intl';

import {CreationOutlineIcon} from '@mattermost/compass-icons/components';

import WithTooltip from 'components/with_tooltip';

type Props = {
    userId: string;
    username: string;
    postAuthorId: string;
};

function AiGeneratedIndicator({userId, username, postAuthorId}: Props) {
    const intl = useIntl();

    const tooltipText = useMemo(() => {
        const isSameAsAuthor = userId === postAuthorId;

        if (isSameAsAuthor) {
            return intl.formatMessage({
                id: 'post_info.ai_generated.self',
                defaultMessage: 'AI-generated',
            });
        }

        return intl.formatMessage(
            {
                id: 'post_info.ai_generated.by_user',
                defaultMessage: 'Message posted by @{username}',
            },
            {username},
        );
    }, [userId, postAuthorId, username, intl]);

    return (
        <WithTooltip title={tooltipText}>
            <span
                className='ai-generated-indicator'
                aria-label={tooltipText}
            >
                <CreationOutlineIcon/>
            </span>
        </WithTooltip>
    );
}

export default memo(AiGeneratedIndicator);
