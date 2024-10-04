// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

type ButtonProps = {
    button: SectionNoticeButton;
    buttonClass: 'btn-primary' | 'btn-tertiary' | 'btn-link';
}

const SectionNoticeButton = ({
    button,
    buttonClass,
}: ButtonProps) => {
    const leading = button.leadingIcon ? (<i className={classNames('icon', button.leadingIcon)}/>) : null;
    const trailing = button.trailingIcon ? (<i className={classNames('icon', button.trailingIcon)}/>) : null;
    return (
        <button
            onClick={button.onClick}
            className={classNames('btn btn-sm sectionNoticeButton', buttonClass)}
        >
            {leading}
            {button.text}
            {trailing}
        </button>
    );
};

export default SectionNoticeButton;
