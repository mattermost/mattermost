// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LocalizedIcon from 'components/localized_icon';

import {t} from 'utils/i18n';

type Props = {
    additionalClassName?: string;
}

function NextIcon(props: Props) {
    const className = 'icon icon-chevron-right' + (props.additionalClassName ? ' ' + props.additionalClassName : '');
    return (
        <LocalizedIcon
            className={className}
            title={{id: t('generic_icons.next'), defaultMessage: 'Next Icon'}}
        />
    );
}

export default React.memo(NextIcon);
