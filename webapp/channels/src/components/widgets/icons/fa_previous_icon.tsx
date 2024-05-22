// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

type Props = {
    additionalClassName?: string;
}

const PreviousIcon = ({additionalClassName}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <i
            className={classNames('icon icon-chevron-left', additionalClassName)}
            title={formatMessage({id: 'generic_icons.previous', defaultMessage: 'Previous Icon'})}
        />
    );
};

export default React.memo(PreviousIcon);
