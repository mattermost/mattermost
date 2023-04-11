// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import IconProps from '@mattermost/compass-icons/components/props';
import React from 'react';
import {InputAdornment} from '@mui/material';
import MUITextField, {TextFieldProps as MUITextFieldProps} from '@mui/material/TextField';

export type TextFieldProps = Omit<MUITextFieldProps, 'InputProps'> & {
    StartIcon?: React.FC<IconProps>;
    EndIcon?: React.FC<IconProps>;
}

export const iconSizeMap = {
    small: 12,
    medium: 16,
    large: 20,
};

/**
 * This component consists of several lower level components which receive their own overrides.
 * These are the components used to build the textfield:
 * - FormControl ({@link ../../themeprovider/component-overrides/form-control.ts})
 * - InputBase ({@link ../../themeprovider/component-overrides/input-base.ts})
 * - InputLabel ({@link ../../themeprovider/component-overrides/input-label.ts})
 * - OutlinedInput ({@link ../../themeprovider/component-overrides/outlined-input.ts})
 * */
const TextField = ({StartIcon, EndIcon, value, onFocus, onBlur, size = 'medium', ...props}: TextFieldProps) => {
    const [shrink, setShrink] = React.useState(Boolean(value));

    const InputProps: MUITextFieldProps['InputProps'] = {};
    const InputLabelProps: MUITextFieldProps['InputLabelProps'] = {
        shrink,
        $withStartIcon: Boolean(StartIcon),
        $inputSize: size,
    };

    if (StartIcon) {
        InputProps.startAdornment = (
            <InputAdornment position='start'>
                <StartIcon size={iconSizeMap[size]}/>
            </InputAdornment>
        );
    }

    if (EndIcon) {
        InputProps.endAdornment = (
            <InputAdornment position='end'>
                <EndIcon size={iconSizeMap[size]}/>
            </InputAdornment>
        );
    }

    const makeFocusHandler = (focus: boolean) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (focus) {
            setShrink(true);
            onFocus?.(e);
            return;
        }

        setShrink(Boolean(value));
        onBlur?.(e);
    };

    return (
        <MUITextField
            {...props}
            size={size}
            onFocus={makeFocusHandler(true)}
            onBlur={makeFocusHandler(false)}
            InputProps={InputProps}
            InputLabelProps={InputLabelProps}
        />
    );
};

export default TextField;
