// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {IconContainer} from '../formatting_bar/formatting_icon';

const PostAttributesButton = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const label = formatMessage({id: 'post_attributes.composer.add', defaultMessage: 'Add attributes'});

    return (
        <WithTooltip title={label}>
            <IconContainer
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
            </IconContainer>
        </WithTooltip>
    );
};

export default memo(PostAttributesButton);
