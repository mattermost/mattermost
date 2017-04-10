// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Agent from 'utils/user_agent.jsx';
import RhsDropdownMenu from 'components/rhs_dropdown_menu.jsx';

import {Dropdown} from 'react-bootstrap';
import React from 'react';

export default class RhsDropdown extends React.Component {
    constructor(props) {
        super(props);

        this.toggleDropdown = this.toggleDropdown.bind(this);

        this.state = {
            showDropdown: false
        };
    }

    toggleDropdown() {
        const showDropdown = !this.state.showDropdown;
        if (Agent.isMobile() || Agent.isMobileApp()) {
            const scroll = document.querySelector('.scrollbar--view');
            if (showDropdown) {
                scroll.style.overflow = 'hidden';
            } else {
                scroll.style.overflow = 'scroll';
            }
        }

        this.setState({showDropdown});
    }

    render() {
        return (
            <Dropdown
                id='rhs_dropdown'
                open={this.state.showDropdown}
                onToggle={this.toggleDropdown}
            >
                <a
                    href='#'
                    className='post__dropdown dropdown-toggle'
                    bsRole='toggle'
                    onClick={this.toggleDropdown}
                />
                <RhsDropdownMenu>
                    {this.props.dropdownContents}
                </RhsDropdownMenu>
            </Dropdown>
        );
    }
}

RhsDropdown.propTypes = {
    dropdownContents: React.PropTypes.array.isRequired
};
