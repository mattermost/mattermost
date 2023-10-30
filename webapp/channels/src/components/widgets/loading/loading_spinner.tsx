// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import type {ReactNode, CSSProperties} from 'react';
import {injectIntl, type IntlShape} from 'react-intl';

type Props = {
    text?: ReactNode;
    style?: CSSProperties;
    intl: IntlShape;
}
class LoadingSpinner extends PureComponent<Props> {
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
