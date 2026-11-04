// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, type JSX} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {IconContainer} from '../formatting_bar/formatting_icon';

// Mirrors IconContainer's [disabled] look, but without pointer-events: none so
// the tooltip still shows on hover and the button keeps its tab stop.
const DisabledIconContainer = styled(IconContainer)`
    &[aria-disabled='true'] {
        cursor: not-allowed;
        color: rgba(var(--center-channel-color-rgb), 0.32);

        &:hover,
        &:active {
            background: transparent;
            color: rgba(var(--center-channel-color-rgb), 0.32);
        }
    }
`;

// Placeholder until messages can be created with attributes, which comes in a
// follow-up. Until then the button does nothing and is rendered as disabled.
const PostAttributesButton = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const label = formatMessage({id: 'post_attributes.composer.add', defaultMessage: 'Add attributes', description: 'Tooltip and accessible label of the button in the message composer formatting bar that opens the modal for adding attributes to the message being written. Plural noun after a verb.'});

    return (
        <WithTooltip title={label}>
            <DisabledIconContainer
                type='button'
                id='postAttributesButton'
                data-testid='post-attributes-composer-add'
                aria-disabled='true'
                aria-label={label}
            >
                <PlusIcon
                    size={18}
                    color={'currentColor'}
                />
            </DisabledIconContainer>
        </WithTooltip>
    );
};

export default memo(PostAttributesButton);
