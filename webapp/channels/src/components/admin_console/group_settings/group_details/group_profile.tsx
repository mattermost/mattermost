// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import type {MessageDescriptor} from 'react-intl';

import AtIcon from '@mattermost/compass-icons/components/at';
import {Icon} from '@mattermost/compass-ui/components/icon';

import Input from 'components/widgets/inputs/input/input';

type Props = {
    name?: string;
    title: MessageDescriptor;
    customID: string;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    showAtMention: boolean;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

const GroupProfile = ({
    name,
    title,
    customID,
    isDisabled,
    isReadOnly,
    showAtMention,
    onChange,
}: Props) => (
    <div
        className='group-profile'
        id={customID}
    >
        <Input
            id={customID + 'Input'}
            name={customID}
            type='text'
            value={name}
            disabled={isDisabled}
            readOnly={isReadOnly}
            onChange={onChange}
            label={title}
            inputPrefix={showAtMention ? <Icon glyph={<AtIcon/>}/> : undefined}
        />
    </div>
);

export default memo(GroupProfile);
