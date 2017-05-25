import PropTypes from 'prop-types';

// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {PureComponent} from 'react';

export default class RhsDropdownButton extends PureComponent {
    static propTypes = {
        onClick: PropTypes.func.isRequired
    }

    render() {
        return (
            <a
                href='#'
                className='post__dropdown dropdown-toggle'
                onClick={this.props.onClick}
            />
        );
    }
}
