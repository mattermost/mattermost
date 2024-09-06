// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import {isMessageDescriptor} from 'utils/i18n';

type Props = {
    text?: React.ReactNode | MessageDescriptor;
    style?: React.CSSProperties;
}
const LoadingSpinner = ({text, style}: Props) => {
    const {formatMessage} = useIntl();

    let renderedText;
    if (isMessageDescriptor(text)) {
        renderedText = formatMessage(text);
    } else {
        renderedText = text;
    }

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
            {renderedText}
        </span>
    );
};

export default React.memo(LoadingSpinner);
