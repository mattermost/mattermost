// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedDate} from 'react-intl';

import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

export default class FloatingTimestamp extends React.Component {
    constructor(props) {
        super(props);

        this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);
    }

    render() {
        if (!this.props.isMobile) {
            return <noscript/>;
        }

        if (this.props.createAt === 0) {
            return <noscript/>;
        }

        const dateString = (
            <FormattedDate
                value={this.props.createAt}
                weekday='short'
                day='2-digit'
                month='short'
                year='numeric'
            />
        );

        let className = 'post-list__timestamp';
        if (this.props.isScrolling) {
            className += ' scrolling';
        }

        return (
            <div className={className}>
                <div>
                    <span>{dateString}</span>
                </div>
            </div>
        );
    }
}

FloatingTimestamp.propTypes = {
    isScrolling: React.PropTypes.bool.isRequired,
    isMobile: React.PropTypes.bool,
    createAt: React.PropTypes.number
};
