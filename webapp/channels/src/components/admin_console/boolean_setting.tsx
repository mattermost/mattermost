// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import * as Utils from 'utils/utils';

import Setting from './setting';

type Props = {
    id: string;
    label: React.ReactNode;
    value: boolean;
    onChange: (id: string, foo: boolean) => void;
    trueText?: React.ReactNode;
    falseText?: React.ReactNode;
    disabled: boolean;
    setByEnv: boolean;
    disabledText?: React.ReactNode;
    helpText: React.ReactNode;
}

export default class BooleanSetting extends React.PureComponent<Props> {
    public static defaultProps = {
        trueText: (
            <FormattedMessage
                id='admin.true'
                defaultMessage='true'
            />
        ),
        falseText: (
            <FormattedMessage
                id='admin.false'
                defaultMessage='false'
            />
        ),
        disabled: false,
    };

    private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.props.onChange(this.props.id, e.target.value === 'true');
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
            >
                <a id={this.props.id}/>
                <label className='radio-inline'>
                    <input
                        data-testid={this.props.id + 'true'}
                        type='radio'
                        value='true'
                        id={Utils.createSafeId(this.props.id) + 'true'}
                        name={this.props.id}
                        checked={this.props.value}
                        onChange={this.handleChange}
                        disabled={this.props.disabled || this.props.setByEnv}
                    />
                    {this.props.trueText}
                </label>
                <label className='radio-inline'>
                    <input
                        data-testid={this.props.id + 'false'}
                        type='radio'
                        value='false'
                        id={Utils.createSafeId(this.props.id) + 'false'}
                        name={this.props.id}
                        checked={!this.props.value}
                        onChange={this.handleChange}
                        disabled={this.props.disabled || this.props.setByEnv}
                    />
                    {this.props.falseText}
                </label>
            </Setting>
        );
    }
}
