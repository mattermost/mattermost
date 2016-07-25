// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import crypto from 'crypto';

import {FormattedMessage} from 'react-intl';

export default class GeneratedSetting extends React.Component {
    static get propTypes() {
        return {
            id: React.PropTypes.string.isRequired,
            label: React.PropTypes.node.isRequired,
            placeholder: React.PropTypes.string,
            value: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired,
            disabled: React.PropTypes.bool.isRequired,
            disabledText: React.PropTypes.node,
            helpText: React.PropTypes.node.isRequired,
            regenerateText: React.PropTypes.node
        };
    }

    static get defaultProps() {
        return {
            disabled: false,
            regenerateText: (
                <FormattedMessage
                    id='admin.regenerate'
                    defaultMessage='Regenerate'
                />
            )
        };
    }

    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.regenerate = this.regenerate.bind(this);
    }

    handleChange(e) {
        this.props.onChange(this.props.id, e.target.value === 'true');
    }

    regenerate(e) {
        e.preventDefault();

        this.props.onChange(this.props.id, crypto.randomBytes(256).toString('base64').substring(0, 32));
    }

    render() {
        let disabledText = null;
        if (this.props.disabled && this.props.disabledText) {
            disabledText = (
                <div className='admin-console__disabled-text'>
                    {this.props.disabledText}
                </div>
            );
        }

        return (
            <div className='form-group'>
                <label
                    className='control-label col-sm-4'
                    htmlFor={this.props.id}
                >
                    {this.props.label}
                </label>
                <div className='col-sm-8'>
                    <input
                        type='text'
                        className='form-control'
                        id={this.props.id}
                        placeholder={this.props.placeholder}
                        value={this.props.value}
                        onChange={this.handleChange}
                        disabled={this.props.disabled}
                    />
                    {disabledText}
                    <div className='help-text'>
                        {this.props.helpText}
                    </div>
                    <div className='help-text'>
                        <button
                            className='btn btn-default'
                            onClick={this.regenerate}
                            disabled={this.props.disabled}
                        >
                            {this.props.regenerateText}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
