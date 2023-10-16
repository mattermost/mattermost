// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LocalizedIcon from 'components/localized_icon';

import {t} from 'utils/i18n';

type Props = {
    text: React.ReactNode;
    style?: React.CSSProperties;
}

export default class LoadingSpinner extends React.PureComponent<Props> {
    public static defaultProps: Props = {
        text: null,
    };

    public render() {
        return (
            <span
                id='loadingSpinner'
                className={'LoadingSpinner' + (this.props.text ? ' with-text' : '')}
                style={this.props.style}
                data-testid='loadingSpinner'
            >
                <LocalizedIcon
                    className='fa fa-spinner fa-fw fa-pulse spinner'
                    component='span'
                    title={{id: t('generic_icons.loading'), defaultMessage: 'Loading Icon'}}
                />
                {this.props.text}
            </span>
        );
    }
}
