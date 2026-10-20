// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import Tag from './tag';
import type {TagSize} from './tag';

type Props = {
    className?: string;
    size?: TagSize;
};

const ImportedInactiveTag = ({className = '', size = 'xs'}: Props) => {
    const {formatMessage} = useIntl();
    return (
        <Tag
            uppercase={true}
            size={size}
            className={classNames('ImportedInactiveTag', className)}
            text={formatMessage({
                id: 'tag.default.imported_inactive',
                defaultMessage: 'IMPORTED - INACTIVE',
            })}
        />
    );
};

export default ImportedInactiveTag;
