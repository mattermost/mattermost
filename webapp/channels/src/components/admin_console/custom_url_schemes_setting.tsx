// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import type {ChangeEvent} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import LocalizedPlaceholderInput from 'components/localized_placeholder_input';

import Setting from './setting';

type Props = {
    id: string;
    value: string[];
    onChange: (id: string, valueAsArray: string[]) => void;
    disabled: boolean;
    setByEnv: boolean;
}

type State = {
    value: string;
}

export default class CustomURLSchemesSetting extends PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            value: this.arrayToString(props.value),
        };
    }

    stringToArray = (str: string): string[] => {
        return str.split(',').map((s) => s.trim()).filter(Boolean);
    };

    arrayToString = (arr: string[]): string => {
        return arr.join(',');
    };

    handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const valueAsArray = this.stringToArray(e.target.value);

        this.props.onChange(this.props.id, valueAsArray);

        this.setState({
            value: e.target.value,
        });
    };

    render() {
        return (
            <Setting
                label={
                    <FormattedMessage
                        id='admin.customization.customUrlSchemes'
                        defaultMessage='Custom URL Schemes:'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='admin.customization.customUrlSchemesDesc'
                        defaultMessage='Allows message text to link if it begins with any of the comma-separated URL schemes listed. By default, the following schemes will create links: "http", "https", "ftp", "tel", and "mailto".'
                    />
                }
                inputId={this.props.id}
                setByEnv={this.props.setByEnv}
            >
                <LocalizedPlaceholderInput
                    id={this.props.id}
                    className='form-control'
                    type='text'
                    placeholder={defineMessage({id: 'admin.customization.customUrlSchemesPlaceholder', defaultMessage: 'E.g.: "git,smtp"'})}
                    value={this.state.value}
                    onChange={this.handleChange}
                    disabled={this.props.disabled || this.props.setByEnv}
                />
            </Setting>
        );
    }
}
