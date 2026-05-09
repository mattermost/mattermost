// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {PostPriorityLabel, PostPriorityValue} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {getPostPriorityLabels} from 'mattermost-redux/selectors/entities/posts';

import Tag from 'components/widgets/tag/tag';
import type {TagSize} from 'components/widgets/tag/tag';

type Props = {
    priority?: PostPriorityValue|'';
    size?: TagSize;
    uppercase?: boolean;
}

function getPriorityLabelText(label: PostPriorityLabel, formatMessage: ReturnType<typeof useIntl>['formatMessage']) {
    if (label.id === PostPriority.URGENT) {
        return formatMessage({id: 'post_priority.priority.urgent', defaultMessage: label.name || 'Urgent'});
    }

    if (label.id === PostPriority.IMPORTANT) {
        return formatMessage({id: 'post_priority.priority.important', defaultMessage: label.name || 'Important'});
    }

    return label.name;
}

export default function PriorityLabel({
    priority,
    ...rest
}: Props) {
    const {formatMessage} = useIntl();
    const postPriorityLabels = useSelector(getPostPriorityLabels);

    if (!priority) {
        return null;
    }

    const label = postPriorityLabels.find((item) => item.id === priority) || {
        id: priority,
        name: priority,
        variant: 'default' as const,
        icon: 'alert-circle-outline',
    };

    return (
        <Tag
            {...rest}
            variant={label.variant}
            icon={label.icon as never}
            text={getPriorityLabelText(label, formatMessage)}
            uppercase={true}
            data-testid='post-priority-label'
        />
    );
}
