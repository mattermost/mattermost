// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Setting from './setting.jsx';

export default class RadioSetting extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
    }

    handleChange(e) {
        this.props.onChange(this.props.id, e.target.value);
    }

    render() {
        const options = [];
        for (const {value, text} of this.props.values) {
            options.push(
                <div className='radio'>
                    <label>
                        <input
                            type='radio'
                            value={value}
                            name={this.props.id}
                            checked={value === this.props.value}
                            onChange={this.handleChange}
                            disabled={this.props.disabled}
                        />
                        {text}
                    </label>
                </div>
            );
        }

        return (
            <Setting
                label={this.props.label}
                inputId={this.props.id}
                helpText={this.props.helpText}
            >
                {options}
            </Setting>
        );
    }
}

RadioSetting.defaultProps = {
    isDisabled: false
};

RadioSetting.propTypes = {
    id: React.PropTypes.string.isRequired,
    values: React.PropTypes.array.isRequired,
    label: React.PropTypes.node.isRequired,
    value: React.PropTypes.string.isRequired,
    onChange: React.PropTypes.func.isRequired,
    disabled: React.PropTypes.bool,
    helpText: React.PropTypes.node
};
