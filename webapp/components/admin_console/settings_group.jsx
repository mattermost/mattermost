import PropTypes from 'prop-types';

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class SettingsGroup extends React.Component {
    static get propTypes() {
        return {
            show: PropTypes.bool.isRequired,
            header: PropTypes.node,
            children: PropTypes.node
        };
    }

    static get defaultProps() {
        return {
            show: true
        };
    }

    render() {
        if (!this.props.show) {
            return null;
        }

        let header = null;
        if (this.props.header) {
            header = (
                <h4>
                    {this.props.header}
                </h4>
            );
        }

        return (
            <div className='admin-settings__group'>
                {header}
                {this.props.children}
            </div>
        );
    }
}
