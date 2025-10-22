// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

import './thread_button.scss';

type Props = {
    prepend?: ReactNode;
    append?: ReactNode;
    isActive?: boolean;
    hasDot?: boolean;
    allowTextOverflow?: boolean;
    marginTop?: boolean;
}

type Attrs = Exclude<ButtonHTMLAttributes<HTMLButtonElement>, Props>

const ThreadButton = React.forwardRef<HTMLButtonElement, Props & Attrs>((
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
            className={classNames('ThreadButton ThreadButton___transparent', {'is-active': isActive, allowTextOverflow}, attrs.className)}
        >
            {prepend && (
                <span className='ThreadButton_prepended'>
                    {prepend}
                </span>
            )}
            <span className={classNames('ThreadButton_label', {margin_top: marginTop})}>
                {children}
                {hasDot && <span className='dot'/>}
            </span>
            {append && (
                <span className='ThreadButton_appended'>
                    {append}
                </span>
            )}
        </button>
    );
});
ThreadButton.displayName = 'ThreadButton';

export default memo(ThreadButton);
