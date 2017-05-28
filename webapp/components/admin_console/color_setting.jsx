// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Setting from './setting.jsx';

import React from 'react';
import PropTypes from 'prop-types';
import {ChromePicker} from 'react-color';

export default class ColorSetting extends React.PureComponent {
    static get propTypes() {
        return {
            id: PropTypes.string.isRequired,
            label: PropTypes.node.isRequired,
            helpText: PropTypes.node,
            value: PropTypes.string.isRequired,
            onChange: PropTypes.func,
            disabled: PropTypes.bool
        };
    }

    constructor(props) {
        super(props);

        this.state = {
            showPicker: false
        };
    }

    componentDidMount() {
        document.addEventListener('click', this.closePicker);
    }

    componentWillUnmount() {
        document.removeEventListener('click', this.closePicker);
    }

    handleChange = (color) => {
        this.props.onChange(this.props.id, color.hex);
    }

    togglePicker = () => {
        if (this.props.disabled) {
            this.setState({showPicker: false});
        }
        this.setState({showPicker: !this.state.showPicker});
    }

    closePicker = (e) => {
        if (!e.target.closest('.picker-' + this.props.id)) {
            this.setState({showPicker: false});
        }
    }

    onTextInput = (e) => {
        this.props.onChange(this.props.id, e.target.value);
    }

    render() {
        let picker;
        if (this.state.showPicker) {
            picker = (
                <div
                    className={'picker-' + this.props.id}
                    style={{position: 'absolute'}}
                >
                    <div style={{position: 'relative', bottom: '100px', left: '10px'}}>
                        <ChromePicker
                            color={this.props.value}
                            onChange={this.handleChange}
                        />
                    </div>
                </div>
            );
        }

        return (
            <Setting
                label={this.props.label}
                helpText={this.props.helpText}
                inputId={this.props.id}
            >
                <div className='input-group'>
                    <input
                        type='text'
                        className='form-control'
                        value={this.props.value}
                        onChange={this.onTextInput}
                        disabled={this.props.disabled}
                    />
                    <span
                        className={'input-group-addon picker-' + this.props.id}
                        onClick={this.togglePicker}
                    >
                        <i style={{backgroundColor: this.props.value}}/>
                    </span>
                    {picker}
                </div>
            </Setting>
        );
    }
}
