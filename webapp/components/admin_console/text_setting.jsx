// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Setting from './setting.jsx';
import Constants from 'utils/constants.jsx';

export default class TextSetting extends React.Component {
    static get propTypes() {
        return {
            id: React.PropTypes.string.isRequired,
            label: React.PropTypes.node.isRequired,
            placeholder: React.PropTypes.string,
            helpText: React.PropTypes.node,
            value: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            maxLength: React.PropTypes.number,
            onChange: React.PropTypes.func.isRequired,
            disabled: React.PropTypes.bool,
            type: React.PropTypes.oneOf([
                'input',
                'textarea'
            ])
        };
    }

    static get defaultProps() {
        return {
            type: 'input',
            maxLength: Constants.MAX_TEXTSETTING_LENGTH
        };
    }

    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
    }

    handleChange(e) {
        this.props.onChange(this.props.id, e.target.value);
    }

    render() {
        let input = null;
        if (this.props.type === 'input') {
            input = (
                <input
                    id={this.props.id}
                    className='form-control'
                    type='text'
                    placeholder={this.props.placeholder}
                    value={this.props.value}
                    maxLength={this.props.maxLength}
                    onChange={this.handleChange}
                    disabled={this.props.disabled}
                />
            );
        } else if (this.props.type === 'textarea') {
            input = (
                <textarea
                    id={this.props.id}
                    className='form-control'
                    rows='5'
                    maxLength='1024'
                    placeholder={this.props.placeholder}
                    value={this.props.value}
                    onChange={this.handleChange}
                    disabled={this.props.disabled}
                />
            );
        }

        return (
            <Setting
                label={this.props.label}
                helpText={this.props.helpText}
                inputId={this.props.id}
            >
                {input}
            </Setting>
        );
    }
}
