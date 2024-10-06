// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

type Props = {
    text?: React.ReactNode;
    style?: React.CSSProperties;
}
const LoadingSpinner = ({text = null, style}: Props) => {
    const {formatMessage} = useIntl();
    return (
        <span
            id='loadingSpinner'
            className={classNames('LoadingSpinner', {'with-text': Boolean(text)})}
            style={style}
            data-testid='loadingSpinner'
        >
            <span
                className='fa fa-spinner fa-fw fa-pulse spinner'
                title={formatMessage({id: 'generic_icons.loading', defaultMessage: 'Loading Icon'})}
            />
            {text}
        </span>
    );
};

export default React.memo(LoadingSpinner);
