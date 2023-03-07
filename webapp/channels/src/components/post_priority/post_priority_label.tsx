// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import Tag, {TagSize} from 'components/widgets/tag/tag';

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
                icon={'alert-outline'}
                text={formatMessage({id: 'post_priority.priority.urgent', defaultMessage: 'URGENT'})}
                uppercase={true}
            />
        );
    }

    if (priority === PostPriority.IMPORTANT) {
        return (
            <Tag
                {...rest}
                variant='info'
                icon={'alert-circle-outline'}
                text={formatMessage({id: 'post_priority.priority.important', defaultMessage: 'IMPORTANT'})}
                uppercase={true}
            />
        );
    }

    return null;
}
