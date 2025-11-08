// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {AlertCircleOutlineIcon, AlertOutlineIcon} from '@mattermost/compass-icons/components';
import {Tag} from '@mattermost/design-system';
import type {TagSize} from '@mattermost/design-system';
import {PostPriority} from '@mattermost/types/posts';

type Props = {
    priority?: PostPriority|'';
    size?: TagSize;
    uppercase?: boolean;
}

export default function PriorityLabel({
    priority,
    ...rest
}: Props) {
    const {formatMessage} = useIntl();

    if (priority === PostPriority.URGENT) {
        return (
            <Tag
                {...rest}
                variant='danger'
                icon={<AlertOutlineIcon/>}
                text={formatMessage({id: 'post_priority.priority.urgent', defaultMessage: 'Urgent'})}
                uppercase={true}
                data-testid='post-priority-label'
            />
        );
    }

    if (priority === PostPriority.IMPORTANT) {
        return (
            <Tag
                {...rest}
                variant='info'
                icon={<AlertCircleOutlineIcon/>}
                text={formatMessage({id: 'post_priority.priority.important', defaultMessage: 'Important'})}
                uppercase={true}
                data-testid='post-priority-label'
            />
        );
    }

    return null;
}
