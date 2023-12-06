// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setting from './setting';

interface Props {
    id: string;
    label: React.ReactNode;
    values: Array<{ text: string; value: string }>;
    value: string;
    setByEnv: boolean;
    disabled?: boolean;
    helpText?: React.ReactNode;
    onChange(id: string, value: any): void;
}
export default class RadioSetting extends React.PureComponent<Props> {
    public static defaultProps: Partial<Props> = {
        disabled: false,
    };

    private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.props.onChange(this.props.id, e.target.value);
    };

    render(): JSX.Element {
        const options = [];
        for (const {value, text} of this.props.values) {
            options.push(
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
                            disabled={this.props.disabled || this.props.setByEnv}
                        />
                        {text}
                    </label>
                </div>,
            );
        }

        return (
            <Setting
                label={this.props.label}
                inputId={this.props.id}
                helpText={this.props.helpText}
                setByEnv={this.props.setByEnv}
            >
                {options}
            </Setting>
        );
    }
}
