// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import Tag, {TagSize} from './tag';

type Props = {
    className?: string;
    size?: TagSize;
}

const BetaTag = ({className = '', size = 'xs'}: Props) => {
    const {formatMessage} = useIntl();
    return (
        <Tag
            uppercase={true}
            size={size}
            variant='info'
            className={classNames('BetaTag', className)}
            text={formatMessage({
                id: 'tag.default.beta',
                defaultMessage: 'BETA',
            })}
        />
    );
};

export default BetaTag;
