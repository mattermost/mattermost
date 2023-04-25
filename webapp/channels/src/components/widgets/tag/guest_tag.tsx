// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';
import {useIntl} from 'react-intl';

import Tag, {TagSize} from './tag';

type Props = {
    className?: string;
    size?: TagSize;
};

const GuestTag = ({className = '', size = 'xs'}: Props) => {
    const {formatMessage} = useIntl();
    return (
        <Tag
            className={classNames('GuestTag', className)}
            size={size}
            text={formatMessage({
                id: 'tag.default.guest',
                defaultMessage: 'GUEST',
            })}
        />
    );
};

export default GuestTag;
