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

const ColorSetting = ({
    id,
    label,
    helpText,
    value,
    onChange,
    disabled = false,
}: Props) => {
    const handleChange = (color: string) => {
        if (onChange) {
            onChange(id, color);
        }
    };

    return (
        <Setting
            label={label}
            helpText={helpText}
            inputId={id}
        >
            <ColorInput
                id={id}
                value={value}
                onChange={handleChange}
                isDisabled={disabled}
            />
        </Setting>
    );
};

export default ColorSetting;
