// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Setting from './setting.jsx';

import {FormattedMessage} from 'react-intl';

export default class BooleanSetting extends React.Component {
    render() {
        return (
            <Setting label={this.props.label}>
                <label className='radio-inline'>
                    <input
                        type='radio'
                        value='true'
                        checked={this.props.currentValue}
                        onChange={this.props.handleChange}
                        disabled={this.props.isDisabled}
                    />
                    {this.props.trueText}
                </label>
                <label className='radio-inline'>
                    <input
                        type='radio'
                        value='false'
                        checked={!this.props.currentValue}
                        onChange={this.props.handleChange}
                        disabled={this.props.isDisabled}
                    />
                    {this.props.falseText}
                </label>
                {this.props.helpText}
            </Setting>
        );
    }
}
BooleanSetting.defaultProps = {
    trueText: (
        <FormattedMessage
            id='admin.ldap.true'
            defaultMessage='true'
        />
    ),
    falseText: (
        <FormattedMessage
            id='admin.ldap.false'
            defaultMessage='false'
        />
    )
};

BooleanSetting.propTypes = {
    label: React.PropTypes.node.isRequired,
    currentValue: React.PropTypes.bool.isRequired,
    trueText: React.PropTypes.node,
    falseText: React.PropTypes.node,
    isDisabled: React.PropTypes.bool.isRequired,
    handleChange: React.PropTypes.func.isRequired,
    helpText: React.PropTypes.node.isRequired
};
