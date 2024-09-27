// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import {formatAsComponent, formatAsString} from 'utils/i18n';

import menuItem from './menu_item';

type Props = {
    onClick: (e: React.MouseEvent) => void;
    ariaLabel?: string | MessageDescriptor;
    text: React.ReactNode | MessageDescriptor;
    extraText?: string;
    id?: string;
    buttonClass?: string;
    rightDecorator?: React.ReactNode;
    isDangerous?: boolean;
    disabled?: boolean;
    sibling?: React.ReactNode;
    iconClassName?: string;
}
export const MenuItemActionImpl = ({
    onClick,
    ariaLabel,
    text,
    extraText,
    id,
    buttonClass,
    rightDecorator,
    isDangerous,
    disabled,
    sibling,
    iconClassName,
}: Props) => {
    const intl = useIntl();

    return (
        <>
            <button
                data-testid={id}
                id={id}
                aria-label={formatAsString(intl.formatMessage, ariaLabel)}
                className={classNames('style--none', buttonClass, {
                    'MenuItem__with-help': extraText,
                    'MenuItem__with-sibling': sibling,
                    disabled,
                    MenuItem__dangerous: isDangerous,
                })}
                onClick={onClick}
                disabled={disabled}
            >
                {iconClassName && <i className={`icon ${iconClassName}`}/>}
                {text && <span className='MenuItem__primary-text'>{formatAsComponent(text)}{rightDecorator}</span>}
                {extraText && <span className='MenuItem__help-text'>{extraText}</span>}
            </button>
            {sibling}
        </>
    );
};

const MenuItemAction = menuItem(MenuItemActionImpl);
MenuItemAction.displayName = 'MenuItemAction';

export default MenuItemAction;
