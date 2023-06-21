// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setting from './setting';

export type InputTypes = 'input' | 'textarea' | 'number' | 'email' | 'tel' | 'url' | 'password'

export type WidgetTextSettingProps = {
    id: string;
    label: React.ReactNode;
    labelClassName?: string;
    placeholder?: string;
    helpText?: React.ReactNode;
    footer?: React.ReactNode;
    value: string | number;
    inputClassName?: string;
    maxLength?: number;
    resizable?: boolean;
    onChange(name: string, value: any): void;
    disabled?: boolean;
    type?: InputTypes;
    autoFocus?: boolean;
}

// Since handle change is read from input and textarea element
type HandleChangeTypes = React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>

export default class TextSetting extends React.PureComponent<WidgetTextSettingProps> {
    public static validTypes: string[] = ['input', 'textarea', 'number', 'email', 'tel', 'url', 'password'];

    public static defaultProps: Partial<WidgetTextSettingProps> = {
        labelClassName: '',
        inputClassName: '',
        type: 'input',
        maxLength: -1, // A negative number allows for values of any length
        resizable: true,
    };

    private handleChange: HandleChangeTypes = (e) => {
        if (this.props.type === 'number') {
            this.props.onChange(this.props.id, parseInt(e.target.value, 10));
        } else {
            this.props.onChange(this.props.id, e.target.value);
        }
    };

    public render(): JSX.Element {
        const {resizable} = this.props;
        let {type} = this.props;
        let input = null;

        if (type === 'textarea') {
            let style = {};
            if (!resizable) {
                style = Object.assign({}, {resize: 'none'});
            }

            input = (
                <textarea
                    autoFocus={this.props.autoFocus}
                    data-testid={this.props.id + 'input'}
                    id={this.props.id}
                    dir='auto'
                    style={style}
                    className='form-control'
                    rows={5}
                    placeholder={this.props.placeholder}
                    value={this.props.value}
                    maxLength={this.props.maxLength}
                    onChange={this.handleChange}
                    disabled={this.props.disabled}
                />
            );
        } else {
            type = ['input', 'email', 'tel', 'number', 'url', 'password'].includes(type) ? type : 'input';

            input = (
                <input
                    autoFocus={this.props.autoFocus}
                    data-testid={this.props.id + type}
                    id={this.props.id}
                    className='form-control'
                    type={type}
                    placeholder={this.props.placeholder}
                    value={this.props.value}
                    maxLength={this.props.maxLength}
                    onChange={this.handleChange}
                    disabled={this.props.disabled}
                />
            );
        }

        return (
            <Setting
                label={this.props.label}
                labelClassName={this.props.labelClassName}
                inputClassName={this.props.inputClassName}
                helpText={this.props.helpText}
                inputId={this.props.id}
                footer={this.props.footer}
            >
                {input}
            </Setting>
        );
    }
}
