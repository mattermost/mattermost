// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

type Props = {
    additionalClassName?: string;
}

const WarningIcon = ({additionalClassName}: Props) => {
    const {formatMessage} = useIntl();
    return (
        <i
            className={classNames('fa fa-warning', additionalClassName)}
            title={formatMessage({id: 'generic_icons.warning', defaultMessage: 'Warning Icon'})}
        />
    );
};

export default React.memo(WarningIcon);
