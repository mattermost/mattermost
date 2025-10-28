// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import Tag from '@mattermost/design-system/src/components/primitives/tag';
import type {TagSize} from '@mattermost/design-system/src/components/primitives/tag';

type Props = {
    className?: string;
    size?: TagSize;
}

const BotTag = ({className = '', size = 'xs'}: Props) => {
    const {formatMessage} = useIntl();
    return (
        <Tag
            uppercase={true}
            size={size}
            className={classNames('BotTag', className)}
            text={formatMessage({
                id: 'tag.default.bot',
                defaultMessage: 'BOT',
            })}
        />
    );
};

export default BotTag;
