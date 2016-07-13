// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

export default class FormError extends React.Component {
    static get propTypes() {
        // accepts either a single error or an array of errors
        return {
            type: React.PropTypes.node,
            error: React.PropTypes.node,
            margin: React.PropTypes.node,
            errors: React.PropTypes.arrayOf(React.PropTypes.node)
        };
    }

    static get defaultProps() {
        return {
            error: null,
            errors: []
        };
    }

    render() {
        if (!this.props.error && this.props.errors.length === 0) {
            return null;
        }

        // look for the first truthy error to display
        let message = this.props.error;

        if (!message) {
            for (const error of this.props.errors) {
                if (error) {
                    message = error;
                }
            }
        }

        if (!message) {
            return null;
        }

        if (this.props.type === 'backstage') {
            return (
                <div className='pull-left has-error'>
                    <label className='control-label'>
                        {message}
                    </label>
                </div>
            );
        }

        if (this.props.margin) {
            return (
                <div className='form-group has-error'>
                    <label className='control-label'>
                        {message}
                    </label>
                </div>
            );
        }

        return (
            <div className='col-sm-12 has-error'>
                <label className='control-label'>
                    {message}
                </label>
            </div>
        );
    }
}
