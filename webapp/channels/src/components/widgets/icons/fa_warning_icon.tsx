// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {defineMessage} from 'react-intl';

import LocalizedIcon from 'components/localized_icon';

type Props = {
    additionalClassName?: string;
}

const iconTitle = defineMessage({
    id: 'generic_icons.warning',
    defaultMessage: 'Warning Icon',
});

const WarningIcon = ({additionalClassName}: Props) => {
    return (
        <LocalizedIcon
            className={classNames('fa fa-warning', additionalClassName)}
            title={iconTitle}
        />
    );
};

export default React.memo(WarningIcon);
