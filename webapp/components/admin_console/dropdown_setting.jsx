// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Setting from './setting.jsx';

export default class DropdownSetting extends React.Component {
    render() {
        const options = [];
        for (const {value, text} of this.props.values) {
            options.push(
                <option
                    value={value}
                    key={value}
                >
                    {text}
                </option>
            );
        }

        return (
            <Setting label={this.props.label}>
                <select
                    className='form-control'
                    value={this.props.currentValue}
                    onChange={this.props.handleChange}
                    disabled={this.props.isDisabled}
                >
                    {options}
                </select>
                {this.props.helpText}
            </Setting>
        );
    }
}
DropdownSetting.defaultProps = {
};

DropdownSetting.propTypes = {
    values: React.PropTypes.array.isRequired,
    label: React.PropTypes.node.isRequired,
    currentValue: React.PropTypes.string.isRequired,
    handleChange: React.PropTypes.func.isRequired,
    isDisabled: React.PropTypes.bool.isRequired,
    helpText: React.PropTypes.node.isRequired
};
