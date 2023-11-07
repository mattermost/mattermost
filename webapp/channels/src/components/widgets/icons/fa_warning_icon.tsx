// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {injectIntl, type IntlShape} from 'react-intl';

type Props = {
    additionalClassName?: string;
    intl: IntlShape;
}

class WarningIcon extends React.PureComponent<Props> {
    public render(): JSX.Element {
        return (
            <i
                className={classNames('fa fa-warning', this.props.additionalClassName)}
                title={this.props.intl.formatMessage({id: 'generic_icons.warning', defaultMessage: 'Warning Icon'})}
            />
        );
    }
}

export default injectIntl(WarningIcon);
