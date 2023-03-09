// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setting from './setting';

type Props = {
    id: string;
    options: Array<{text: string; value: string}>;
    label: React.ReactNode;
    onChange(name: string, value: any): void;
    value?: string;
    labelClassName?: string;
    inputClassName?: string;
    helpText?: React.ReactNode;

}

export default class RadioSetting extends React.PureComponent<Props> {
    public static defaultProps: Partial<Props> = {
        labelClassName: '',
        inputClassName: '',
        options: [],
    };

    private handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        this.props.onChange(this.props.id, e.target.value);
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
                {
                    this.props.options.map(({value, text}) => {
                        return (
                            <div
                                className='radio'
                                key={value}
                            >
                                <label>
                                    <input
                                        type='radio'
                                        value={value}
                                        name={this.props.id}
                                        checked={value === this.props.value}
                                        onChange={this.handleChange}
                                    />
                                    {text}
                                </label>
                            </div>
                        );
                    })
                }
            </Setting>
        );
    }
}
