// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'crypto';

import React from 'react';
import {FormattedMessage} from 'react-intl';

import SetByEnv from './set_by_env';

type Props = {
    id: string;
    label: React.ReactNode;
    placeholder?: string;
    value: string;
    onChange: (id: string, s: string) => void;
    disabled: boolean;
    setByEnv: boolean;
    disabledText?: React.ReactNode;
    helpText: React.ReactNode;
    regenerateText: React.ReactNode;
    regenerateHelpText?: React.ReactNode;
}

export default class GeneratedSetting extends React.PureComponent<Props> {
    public static get defaultProps() {
        return {
            disabled: false,
            regenerateText: (
                <FormattedMessage
                    id='admin.regenerate'
                    defaultMessage='Regenerate'
                />
            ),
        };
    }

    private regenerate = (e: React.MouseEvent) => {
        e.preventDefault();

        // Pure base64 implementation can contain characters that are not URL safe without additional
        // encoding. Adopt a URL/Filename safer alphabet as noted in https://datatracker.ietf.org/doc/html/rfc4648#section-5
        // where: 62 - (minus) , 63 _ (underscore)
        const value = crypto.randomBytes(256).toString('base64').substring(0, 32);
        this.props.onChange(this.props.id, value.replaceAll('+', '-').replaceAll('/', '_'));
    };

    public render() {
        let disabledText = null;
        if (this.props.disabled && this.props.disabledText) {
            disabledText = (
                <div className='admin-console__disabled-text'>
                    {this.props.disabledText}
                </div>
            );
        }

        let regenerateHelpText = null;
        if (this.props.regenerateHelpText) {
            regenerateHelpText = (
                <div className='help-text'>
                    {this.props.regenerateHelpText}
                </div>
            );
        }

        let text: React.ReactNode = this.props.value;
        if (!text) {
            text = (
                <span className='placeholder-text'>{this.props.placeholder}</span>
            );
        }

        return (
            <div className='form-group'>
                <label
                    className='control-label col-sm-4'
                    htmlFor={this.props.id}
                >
                    {this.props.label}
                </label>
                <div className='col-sm-8'>
                    <div
                        className='form-control disabled'
                        id={this.props.id}
                    >
                        {text}
                    </div>
                    {disabledText}
                    <div className='help-text'>
                        {this.props.helpText}
                    </div>
                    <div className='help-text'>
                        <button
                            type='button'
                            className='btn btn-tertiary'
                            onClick={this.regenerate}
                            disabled={this.props.disabled || this.props.setByEnv}
                        >
                            {this.props.regenerateText}
                        </button>
                    </div>
                    {regenerateHelpText}
                    {this.props.setByEnv ? <SetByEnv/> : null}
                </div>
            </div>
        );
    }
}
