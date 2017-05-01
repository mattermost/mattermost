// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedDate} from 'react-intl';

import React from 'react';
import PropTypes from 'prop-types';

export default class FloatingTimestamp extends React.PureComponent {
    static propTypes = {
        isScrolling: PropTypes.bool.isRequired,
        isMobile: PropTypes.bool,
        createAt: PropTypes.number,
        isRhsPost: PropTypes.bool
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

        if (this.props.isRhsPost) {
            className += ' rhs';
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
