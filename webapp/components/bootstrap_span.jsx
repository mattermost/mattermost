// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

class BootstrapSpan extends React.PureComponent {

    static propTypes = {
        children: PropTypes.element
    }

    render() {
        const {children, ...props} = this.props;
        delete props.bsRole;
        delete props.bsClass;

        return <span {...props}>{children}</span>;
    }
}

export default BootstrapSpan;
