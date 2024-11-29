// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import type {SectionNoticeButtonProp} from './types';

type Props = {
    button: SectionNoticeButtonProp;
    buttonClass: 'btn-primary' | 'btn-secondary' | 'btn-tertiary' | 'btn-link';
}

const SectionNoticeButton = ({
    button,
    buttonClass,
}: Props) => {
    const leading = button.leadingIcon ? (<i className={classNames('icon', button.leadingIcon)}/>) : null;
    const trailing = button.trailingIcon ? (<i className={classNames('icon', button.trailingIcon)}/>) : null;
    return (
        <button
            onClick={button.onClick}
            className={classNames('btn btn-sm sectionNoticeButton', buttonClass)}
            disabled={button.disabled}
        >
            {button.loading && (<i className='icon fa fa-pulse fa-spinner'/>)}
            {leading}
            {button.text}
            {trailing}
        </button>
    );
};

export default SectionNoticeButton;
