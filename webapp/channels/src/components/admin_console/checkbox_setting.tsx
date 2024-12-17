// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SetByEnv from './set_by_env';

type Props = {
    id: string;
    label: React.ReactNode;
    defaultChecked?: boolean;
    onChange: (id: string, foo: boolean) => void;
    disabled: boolean;
    setByEnv: boolean;
}

export default class CheckboxSetting extends React.PureComponent<Props> {
    public static defaultProps = {
        disabled: false,
    };

    private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.props.onChange(this.props.id, e.target.checked);
    };

    public render() {
        return (
            <div>
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
                {this.props.setByEnv ? <SetByEnv/> : null}
            </div>
        );
    }
}
