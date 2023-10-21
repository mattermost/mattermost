// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

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

const ColorSetting = (props: Props) => {
    const handleChange = useCallback((color: string) => {
        if (props.onChange) {
            props.onChange(props.id, color);
        }
    }, [props.id, props.onChange]);

    return (
        <Setting
            label={props.label}
            helpText={props.helpText}
            inputId={props.id}
        >
            <ColorInput
                id={props.id}
                value={props.value}
                onChange={handleChange}
                isDisabled={props.disabled}
            />
        </Setting>
    );
};

export default React.memo(ColorSetting);
