// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './header_icon_button.scss';

type HeaderIconButtonProps = React.HTMLAttributes<HTMLButtonElement> & {
    icon: string;

    active?: boolean;
    toggled?: boolean;
};

const HeaderIconButton = React.forwardRef<HTMLButtonElement, HeaderIconButtonProps>(({
    icon = 'mattermost',
    active,
    toggled,
    ...otherProps
}, ref) => {
    return (
        <button
            ref={ref}
            className={classNames('HeaderIconButton', {
                'HeaderIconButton--toggled': toggled,
                'HeaderIconButton--active': active,
            })}
            {...otherProps}
        >
            <i className={`icon-${icon}`}/>
        </button>
    );
});
HeaderIconButton.displayName = 'HeaderIconButton';
export default HeaderIconButton;
