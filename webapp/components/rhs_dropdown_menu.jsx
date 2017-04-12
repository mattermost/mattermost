// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {Dropdown} from 'react-bootstrap';
import React from 'react';

export default class RhsDropdownMenu extends Dropdown.Menu {
    constructor(props) { //eslint-disable-line no-useless-constructor
        super(props);
    }

    render() {
        return (
            <div
                className='dropdown-menu__content'
                onClick={this.props.onClose}
            >
                {super.render()}
            </div>
        );
    }
}
