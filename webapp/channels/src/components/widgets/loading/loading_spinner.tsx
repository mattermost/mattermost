// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

type Props = {
    text?: React.ReactNode;
    style?: React.CSSProperties;
    intl: IntlShape;
}
class LoadingSpinner extends React.PureComponent<Props> {
    public static defaultProps: Partial<Props> = {
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
                <span
                    className='fa fa-spinner fa-fw fa-pulse spinner'
                    title={this.props.intl.formatMessage({id: 'generic_icons.loading', defaultMessage: 'Loading Icon'})}
                />
                {this.props.text}
            </span>
        );
    }
}

export default injectIntl(LoadingSpinner);
