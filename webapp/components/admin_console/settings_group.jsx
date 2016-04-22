// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class SettingsGroup extends React.Component {
    static get propTypes() {
        return {
            show: React.PropTypes.bool.isRequired,
            header: React.PropTypes.node,
            children: React.PropTypes.node
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
