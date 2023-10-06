// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LocalizedIcon from 'components/localized_icon';

import {t} from 'utils/i18n';

type Props = {
    additionalClassName?: string;
}

function PreviousIcon(props: Props) {
    const className = 'icon icon-chevron-left' + (props.additionalClassName ? ' ' + props.additionalClassName : '');
    return (
        <LocalizedIcon
            className={className}
            title={{id: t('generic_icons.previous'), defaultMessage: 'Previous Icon'}}
        />
    );
}

export default React.memo(PreviousIcon);

