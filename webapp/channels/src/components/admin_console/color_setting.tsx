// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ColorInput from 'components/color_input';

import Setting from './setting';

type Props = {
    id: string;
    label: React.ReactNode;
    helpText?: React.ReactNode;
    value: string;
    onChange?: (id: string, color: string) => void;
    disabled?: boolean;
}

export default class ColorSetting extends React.PureComponent<Props> {
    private handleChange = (color: string) => {
        if (this.props.onChange) {
            this.props.onChange(this.props.id, color);
        }
    }

    public render() {
        return (
            <Setting
                label={this.props.label}
                helpText={this.props.helpText}
                inputId={this.props.id}
            >
                <ColorInput
                    id={this.props.id}
                    value={this.props.value}
                    onChange={this.handleChange}
                    isDisabled={this.props.disabled}
                />
            </Setting>
        );
    }
}
