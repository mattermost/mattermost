// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setting from './setting';

type Props = {
    id: string;
    label: React.ReactNode;
    defaultChecked?: boolean;
    onChange: (id: string, foo: boolean) => void;
    disabled: boolean;
    setByEnv: boolean;
    disabledText?: React.ReactNode;
    helpText?: React.ReactNode;
}

export default class CheckboxSetting extends React.PureComponent<Props> {
    public static defaultProps = {
        disabled: false,
    };

    private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.props.onChange(this.props.id, e.target.checked);
    };

    public render() {
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
                inputId={this.props.id}
                label={this.props.label}
                helpText={helpText}
                setByEnv={this.props.setByEnv}
                nested={true}
            >
                <a id={this.props.id}/>
                <label className='checkbox-inline'>
                    <input
                        data-testid={this.props.id}
                        type='checkbox'
                        id={this.props.id}
                        name={this.props.id}
                        defaultChecked={this.props.defaultChecked}
                        onChange={this.handleChange}
                        disabled={this.props.disabled || this.props.setByEnv}
                    />
                    {this.props.label}
                </label>
            </Setting>
        );
    }
}
