// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

import './button.scss';

type Props = {
    prepend?: ReactNode;
    append?: ReactNode;
    isActive?: boolean;
    hasDot?: boolean;
    allowTextOverflow?: boolean;
    marginTop?: boolean;
}

type Attrs = Exclude<ButtonHTMLAttributes<HTMLButtonElement>, Props>

const Button = React.forwardRef<HTMLButtonElement, Props & Attrs>((
    {
        prepend,
        append,
        children,
        isActive,
        hasDot,
        marginTop,
        allowTextOverflow = false,
        ...attrs
    },
    ref,
) => {
    return (
        <button
            ref={ref}
            {...attrs}
            className={classNames('Button Button___transparent', {'is-active': isActive, allowTextOverflow}, attrs.className)}
        >
            {prepend && (
                <span className='Button_prepended'>
                    {prepend}
                </span>
            )}
            <span className={classNames('Button_label', {margin_top: marginTop})}>
                {children}
                {hasDot && <span className='dot'/>}
            </span>
            {append && (
                <span className='Button_appended'>
                    {append}
                </span>
            )}
        </button>
    );
});
Button.displayName = 'Button';

export default memo(Button);
