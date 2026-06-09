// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import {Button, type ButtonEmphasis} from '@mattermost/shared/components/button';

import type {SectionNoticeButtonProp} from './types';

type Props = {
    button: SectionNoticeButtonProp;
    emphasis?: ButtonEmphasis;
    buttonClass?: 'btn-link';
}

const SectionNoticeButton = ({
    button,
    emphasis,
    buttonClass,
}: Props) => {
    const leading = button.leadingIcon ? (<i className={classNames('icon', button.leadingIcon)}/>) : null;
    const trailing = button.trailingIcon ? (<i className={classNames('icon', button.trailingIcon)}/>) : null;
    return (
        <Button
            onClick={button.onClick}
            emphasis={emphasis}
            size='sm'
            className={classNames('sectionNoticeButton', buttonClass)}
            disabled={button.disabled}
        >
            {button.loading && (<i className='icon fa fa-pulse fa-spinner'/>)}
            {leading}
            {button.text}
            {trailing}
        </Button>
    );
};

export default SectionNoticeButton;
