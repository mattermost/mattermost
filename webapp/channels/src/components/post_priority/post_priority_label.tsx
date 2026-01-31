// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {PostPriority} from '@mattermost/types/posts';

import {getPluginPriorityTypes} from 'selectors/plugins';

import Tag from 'components/widgets/tag/tag';
import type {TagSize} from 'components/widgets/tag/tag';

type Props = {
    priority?: PostPriority|string|'';
    size?: TagSize;
    uppercase?: boolean;
}

export default function PriorityLabel({
    priority,
    ...rest
}: Props) {
    const {formatMessage} = useIntl();
    const pluginPriorityTypes = useSelector(getPluginPriorityTypes);

    if (priority === PostPriority.URGENT) {
        return (
            <Tag
                {...rest}
                variant='danger'
                icon={'alert-outline'}
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
                icon={'alert-circle-outline'}
                text={formatMessage({id: 'post_priority.priority.important', defaultMessage: 'Important'})}
                uppercase={true}
                data-testid='post-priority-label'
            />
        );
    }

    // Check for plugin-registered priority types
    if (priority && pluginPriorityTypes[priority]) {
        const customType = pluginPriorityTypes[priority];
        return (
            <Tag
                {...rest}
                variant={customType.variant}
                icon={customType.icon}
                text={customType.label}
                uppercase={true}
                data-testid='post-priority-label'
                style={customType.variant === 'custom' && customType.color ? {
                    '--tag-bg': customType.color + '1a',
                    '--tag-color': customType.color,
                } as React.CSSProperties : undefined}
            />
        );
    }

    return null;
}
