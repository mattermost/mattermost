// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
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

            if (this.link) {
                ReactDOM.findDOMNode(this.link).blur();
            }

            this.props.actions.deferNavigation(() => {
                browserHistory.push(this.props.to);
            });
        }
    }

    render() {
        // filter props we don't want to pass using spread rest syntax
        const {blocked, actions, ...rest} = this.props;
        return (
            <Link
                {...rest}
                onClick={this.handleClick}
                ref={(elem) => {
                    this.link = elem;
                }}
            />
        );
    }
}
