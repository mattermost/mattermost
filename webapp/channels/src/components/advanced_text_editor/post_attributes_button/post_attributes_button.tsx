// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useId, type JSX} from 'react';
import {useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {PropertyField} from '@mattermost/types/properties';

import PostAttributesFieldPicker from 'components/post_attributes/post_attributes_field_picker';

type Props = {

    // The fields the picker offers. The editor works this out once and shares
    // it with the composer's inline add control.
    fields: PropertyField[];
    onSelect: (fieldId: string) => void;

    // Why no attribute can be added right now; disables the button.
    disabledReason?: string;

    testIdScope?: string;
};

/**
 * The `+` in the composer's action row: opens the same field picker as the
 * inline `+ Add attribute` after the chips, so an attribute can be staged
 * before any chip is on screen.
 *
 * Omitted rather than disabled when there is nothing left to offer.
 */
const PostAttributesButton = ({fields, onSelect, disabledReason, testIdScope}: Props): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const label = formatMessage({id: 'post_attributes.composer.add', defaultMessage: 'Add attributes', description: 'Tooltip and accessible label of the button in the message composer formatting bar that opens a menu of attributes to add to the message being written. Plural noun after a verb.'});

    // The centre channel and the thread sidebar each have an action row.
    const instanceId = useId();

    if (fields.length === 0) {
        return null;
    }

    return (
        <PostAttributesFieldPicker
            id={`postAttributesButton-${instanceId}`}
            dataTestId='post-attributes-composer-add'
            testIdScope={testIdScope}
            fields={fields}
            onSelect={onSelect}
            disabledReason={disabledReason}
            trigger={{
                label,
                icon: <Icon glyph={<PlusIcon/>}/>,
            }}
        />
    );
};

export default memo(PostAttributesButton);
