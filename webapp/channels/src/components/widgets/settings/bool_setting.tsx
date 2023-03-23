// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setting from './setting';

type Props = {
    id: string;
    label: React.ReactNode;
    labelClassName: string;
    helpText?: React.ReactNode;
    placeholder: string;
    value: boolean;
    disabled?: boolean;
    inputClassName: string;
    onChange(name: string, value: any): void; // value is any since onChange is a common func for inputs and checkboxes
    autoFocus?: boolean;
}

export default class BoolSetting extends React.PureComponent<Props> {
    public static defaultProps: Partial<Props> = {
        labelClassName: '',
        inputClassName: '',
    };

    private handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        this.props.onChange(this.props.id, e.target.checked);
    }

    public render(): JSX.Element {
        return (
            <Setting
                label={this.props.label}
                labelClassName={this.props.labelClassName}
                inputClassName={this.props.inputClassName}
                helpText={this.props.helpText}
                inputId={this.props.id}
            >
                <div className='checkbox'>
                    <label>
                        <input
                            id={this.props.id}
                            disabled={this.props.disabled}
                            autoFocus={this.props.autoFocus}
                            type='checkbox'
                            checked={this.props.value}
                            onChange={this.handleChange}
                        />
                        <span>{this.props.placeholder}</span>
                    </label>
                </div>
            </Setting>
        );
    }
}
