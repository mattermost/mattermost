// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {t} from 'utils/i18n';

type Props = {
    text?: React.ReactNode;
    style?: React.CSSProperties;
}

const LoadingSpinner: React.FunctionComponent<Props> = ({text = null, style}: Props) => {
    const {formatMessage} = useIntl();
    return (
        <div
            id='loadingSpinner'
            className={'LoadingSpinner'}
            style={style}
            data-testid='loadingSpinner'
            title={formatMessage({id: t('generic_icons.loading'), defaultMessage: 'Loading Icon'})}
        >
            <div/><div/><div/><div/>{text && <div className='loadingSpinnerText'>{text}</div>}
        </div>

    );
};
export default LoadingSpinner;
