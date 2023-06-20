// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment, FC, InputHTMLAttributes, forwardRef} from 'react';

import classNames from 'classnames';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    className: string;
    defaultValue?: string;
    maxLength: number;
}

// An input component that renders a validation message (-{number of exceeding characters})
// when the characters length of the value exceeds maxLength prop
// to be used with QuickInput as an inputComponent
const MaxLengthInput: FC<InputProps> = forwardRef<HTMLInputElement, InputProps>(
    ({className, defaultValue, maxLength, ...props}: InputProps, ref) => {
        const excess: number = defaultValue ? defaultValue.length - maxLength : 0;

        const classes: string = classNames({
            MaxLengthInput: true,
            [className]: Boolean(className),
            'has-error': excess > 0,
        });

        return (
            <Fragment>
                <input
                    className={classes}
                    defaultValue={defaultValue}
                    ref={ref}
                    {...props}
                />
                {excess > 0 && (
                    <span className='MaxLengthInput__validation'>
                        {'-'}
                        {excess}
                    </span>
                )}
            </Fragment>
        );
    },
);

export default MaxLengthInput;
