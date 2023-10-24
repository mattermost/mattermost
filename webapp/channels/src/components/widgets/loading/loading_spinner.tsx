// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LocalizedIcon from 'components/localized_icon';

import classNames from 'classnames';

import { defineMessage } from 'react-intl';

type Props = {
    text: React.ReactNode;
    style?: React.CSSProperties;
}

const IconTitle = defineMessage({id: 'generic_icons.loading', defaultMessage: 'Loading Icon'});

const LoadingSpinner = ({ text = null, style }: Props) => {
    return (
        <span
            id='loadingSpinner'
            className={classNames('LoadingSpinner', {'with-text': Boolean(text)})}
            style={style}
            data-testid='loadingSpinner'
        >
            <LocalizedIcon
                className='fa fa-spinner fa-fw fa-pulse spinner'
                component='span'
                title={IconTitle}
            />
            {text}
        </span>
    );
}

export default React.memo(LoadingSpinner)
