// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Spinner} from '@mattermost/compass-ui/components/spinner';
import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import {formatAsComponent} from 'utils/i18n';

type Props = {
    text?: React.ReactNode | MessageDescriptor;
    style?: React.CSSProperties;
};
const LoadingSpinner = ({text, style}: Props) => {
    const {formatMessage} = useIntl();
    const ariaLabel = formatMessage({id: 'generic_icons.loading', defaultMessage: 'Loading Icon'});

    return (
        <span
            id='loadingSpinner'
            className={classNames('LoadingSpinner', {'with-text': Boolean(text)})}
            style={style}
            data-testid='loadingSpinner'
        >
            <Spinner
                size='16'
                className='spinner'
                aria-label={ariaLabel}
            />
            {formatAsComponent(text)}
        </span>
    );
};

export default React.memo(LoadingSpinner);
