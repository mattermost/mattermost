// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import {Spinner} from '@mattermost/compass-ui/components/spinner';
import type {SpinnerSize} from '@mattermost/compass-ui/components/spinner';

import {formatAsComponent} from 'utils/i18n';

type Props = {
    text?: React.ReactNode | MessageDescriptor;
    style?: React.CSSProperties;
    size?: SpinnerSize;

    /** Renders the Font Awesome spinner. Used inside buttons until they move to the Compass Button. */
    legacy?: boolean;
};

const LoadingSpinner = ({
    text,
    style,
    size = '16',
    legacy = false,
}: Props) => {
    const {formatMessage} = useIntl();
    const ariaLabel = formatMessage({id: 'generic_icons.loading', defaultMessage: 'Loading Icon'});

    return (
        <span
            id='loadingSpinner'
            className={classNames('LoadingSpinner', {'with-text': Boolean(text)})}
            style={style}
            data-testid='loadingSpinner'
        >
            {legacy ? (
                <span
                    className='fa fa-spinner fa-fw fa-pulse spinner'
                    title={ariaLabel}
                />
            ) : (
                <Spinner
                    size={size}
                    className='spinner'
                    aria-label={ariaLabel}
                />
            )}
            {formatAsComponent(text)}
        </span>
    );
};

export default React.memo(LoadingSpinner);
