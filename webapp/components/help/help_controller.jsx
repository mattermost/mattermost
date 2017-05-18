import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';

export default class HelpController extends React.Component {
    static get propTypes() {
        return {
            children: PropTypes.node.isRequired
        };
    }

    componentWillUpdate() {
        ReactDOM.findDOMNode(this).scrollIntoView();
    }

    render() {
        return (
            <div className='help'>
                <div className='container col-sm-10 col-sm-offset-1'>
                    {this.props.children}
                </div>
            </div>
        );
    }
}
