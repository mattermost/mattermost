// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl, type IntlShape} from 'react-intl';

type Props = {
    additionalClassName?: string;
    intl: IntlShape;
}

class WarningIcon extends React.PureComponent<Props> {
    public static defaultProps: Partial<Props> = {
        additionalClassName: null,
    };

    public render(): JSX.Element {
        const className = 'fa fa-warning' + (this.props.additionalClassName ? ' ' + this.props.additionalClassName : '');
        return (
            <i
                className={className}
                title={this.props.intl.formatMessage({id: 'generic_icons.warning', defaultMessage: 'Warning Icon'})}
            />
        );
    }
}

export default injectIntl(WarningIcon);
