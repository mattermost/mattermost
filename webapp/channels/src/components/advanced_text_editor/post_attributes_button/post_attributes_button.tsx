// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, type JSX} from 'react';
import {useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

// Placeholder until messages can be created with attributes, which comes in a
// follow-up. Until then the button does nothing and is rendered as disabled.
//
// asChild + disabled makes IconButton set aria-disabled and its disabled styling
// on the child instead of the native disabled attribute, so the tooltip still
// shows on hover and the button keeps its tab stop.
const PostAttributesButton = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const label = formatMessage({id: 'post_attributes.composer.add', defaultMessage: 'Add attributes', description: 'Tooltip and accessible label of the button in the message composer formatting bar that opens the modal for adding attributes to the message being written. Plural noun after a verb.'});

    return (
        <WithTooltip title={label}>
            <IconButton
                asChild={true}
                size='small'
                icon={<Icon glyph={<PlusIcon/>}/>}
                aria-label={label}
                disabled={true}
            >
                <button
                    type='button'
                    id='postAttributesButton'
                    data-testid='post-attributes-composer-add'
                />
            </IconButton>
        </WithTooltip>
    );
};

export default memo(PostAttributesButton);
