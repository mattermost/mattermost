import PropTypes from 'prop-types';

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Constants from 'utils/constants.jsx';

export default class SidebarHeaderDropdownButton extends React.PureComponent {
    static propTypes = {
        bsRole: PropTypes.oneOf(['toggle']).isRequired, // eslint-disable-line react/no-unused-prop-types
        onClick: PropTypes.func.isRequired
    };

    render() {
        return (
            <a
                href='#'
                id='sidebarHeaderDropdownButton'
                className='sidebar-header-dropdown__toggle'
                onClick={this.props.onClick}
            >
                <span
                    className='sidebar-header-dropdown__icon'
                    dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}}
                />
            </a>
        );
    }
}

