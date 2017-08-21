import PropTypes from 'prop-types';

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Constants from 'utils/constants.jsx';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

export default class SidebarHeaderDropdownButton extends React.PureComponent {
    static propTypes = {
        bsRole: PropTypes.oneOf(['toggle']).isRequired, // eslint-disable-line react/no-unused-prop-types
        onClick: PropTypes.func.isRequired
    };

    render() {
        const mainMenuToolTip = (
            <Tooltip id='main-menu__tooltip'>
                <FormattedMessage
                    id='sidebar.mainMenu'
                    defaultMessage='Main menu'
                />
            </Tooltip>
        );

        return (
            <OverlayTrigger
                trigger={['hover', 'focus']}
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='right'
                overlay={mainMenuToolTip}
            >
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
            </OverlayTrigger>
        );
    }
}
