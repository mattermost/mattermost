// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ReactNode, CSSProperties} from 'react';
import {useIntl} from 'react-intl';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

type Props = {
    position?: 'absolute' | 'fixed' | 'relative' | 'static' | 'inherit';
    style?: CSSProperties;
    message?: ReactNode;
    className?: string;
    centered?: boolean;
};

function LoadingScreen({message, position = 'relative', style, className = '', centered = false}: Props) {
    const {formatMessage} = useIntl();

    return (
        <div
            data-testid='loading-screen'
            className={classNames('loading-screen', className, {
                'loading-screen--in-middle': centered,
            })}
            style={{position, ...style}}
        >
            <div className='loading__content'>
                <LoadingSpinner
                    text={message || formatMessage({id: 'loading_screen.loading', defaultMessage: 'Loading'})}
                />
            </div>
        </div>
    );
}

export default LoadingScreen;
