import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {Component} from 'react';
import {Dropdown} from 'react-bootstrap';

import RhsDropdownButton from 'components/rhs_dropdown_button.jsx';
import RhsDropdownMenu from 'components/rhs_dropdown_menu.jsx';

import * as Agent from 'utils/user_agent.jsx';

export default class RhsDropdown extends Component {
    static propTypes = {
        dropdownContents: PropTypes.array.isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            showDropdown: false
        };
    }

    toggleDropdown = () => {
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
                <RhsDropdownButton
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

