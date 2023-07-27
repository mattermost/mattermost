// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';

import SetByEnv from './set_by_env';
import classNames from 'classnames';

export type Props = {
    inputId?: string;
    label: React.ReactNode;
    children: React.ReactNode;
    helpText?: React.ReactNode;
    setByEnv?: boolean;
    nested?: boolean;
}

export default class Settings extends PureComponent<Props> {
    public static defaultProps = {
        nested: false,
    };
    public render() {
        const {
            children,
            setByEnv,
            helpText,
            inputId,
            label,
        } = this.props;

        return (
            <div
                data-testid={inputId}
                className='form-group'
            >
                {!this.props.nested && (
                    <label
                        className='control-label col-sm-4'
                        htmlFor={inputId}
                    >
                        {label}
                    </label>
                )}
                <div
                    className={classNames({
                        'col-sm-8': this.props.nested === false,
                        'col-sm-12': this.props.nested === true,
                    })}
                >
                    {children}
                    <div
                        data-testid={inputId + 'help-text'}
                        className='help-text'
                    >
                        {helpText}
                    </div>
                    {setByEnv ? <SetByEnv/> : null}
                </div>
            </div>
        );
    }
}
