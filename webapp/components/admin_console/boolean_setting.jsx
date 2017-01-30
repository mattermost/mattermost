// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Setting from './setting.jsx';

import {FormattedMessage} from 'react-intl';

export default class BooleanSetting extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
    }

    handleChange(e) {
        this.props.onChange(this.props.id, e.target.value === 'true');
    }

    render() {
        let helpText;
        if (this.props.disabled && this.props.disabledText) {
            helpText = (
                <div>
                    <span className='admin-console__disabled-text'>
                        {this.props.disabledText}
                    </span>
                    {this.props.helpText}
                </div>
            );
        } else {
            helpText = this.props.helpText;
        }

        return (
            <Setting
                label={this.props.label}
                helpText={helpText}
            >
                <label className='radio-inline'>
                    <input
                        type='radio'
                        value='true'
                        name={this.props.id}
                        checked={this.props.value}
                        onChange={this.handleChange}
                        disabled={this.props.disabled}
                    />
                    {this.props.trueText}
                </label>
                <label className='radio-inline'>
                    <input
                        type='radio'
                        value='false'
                        name={this.props.id}
                        checked={!this.props.value}
                        onChange={this.handleChange}
                        disabled={this.props.disabled}
                    />
                    {this.props.falseText}
                </label>
            </Setting>
        );
    }
}
BooleanSetting.defaultProps = {
    trueText: (
        <FormattedMessage
            id='admin.true'
            defaultMessage='true'
        />
    ),
    falseText: (
        <FormattedMessage
            id='admin.false'
            defaultMessage='false'
        />
    ),
    disabled: false
};

BooleanSetting.propTypes = {
    id: React.PropTypes.string.isRequired,
    label: React.PropTypes.node.isRequired,
    value: React.PropTypes.bool.isRequired,
    onChange: React.PropTypes.func.isRequired,
    trueText: React.PropTypes.node,
    falseText: React.PropTypes.node,
    disabled: React.PropTypes.bool.isRequired,
    disabledText: React.PropTypes.node,
    helpText: React.PropTypes.node.isRequired
};
