// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import {Link, browserHistory} from 'react-router/es6';

export default class BlockableLink extends React.Component {
    static propTypes = {

        /*
         * Bool whether navigation is blocked
         */
        blocked: PropTypes.bool.isRequired,

        /*
         * String Link destination
         */
        to: PropTypes.string.isRequired,

        actions: PropTypes.shape({

            /*
             * Function for deferring navigation while blocked
             */
            deferNavigation: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(e) {
        if (this.props.blocked) {
            e.preventDefault();

            if (this.refs.link) {
                ReactDOM.findDOMNode(this.refs.link).blur();
            }

            this.props.actions.deferNavigation(() => {
                browserHistory.push(this.props.to);
            });
        }
    }

    render() {
        const props = {...this.props};
        Reflect.deleteProperty(props, 'blocked');
        Reflect.deleteProperty(props, 'actions');

        return (
            <Link
                {...props}
                onClick={this.handleClick}
                ref='link'
            />
        );
    }
}
