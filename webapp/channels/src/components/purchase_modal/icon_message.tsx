// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './icon_message.scss';

type Props = {
    icon: JSX.Element;
    error?: boolean;
    formattedButtonText?: JSX.Element;
    formattedLinkText?: React.ReactNode;
    formattedTertiaryButonText?: JSX.Element;
    formattedTitle?: JSX.Element;
    formattedSubtitle?: React.ReactNode;
    buttonHandler?: () => void;
    tertiaryButtonHandler?: () => void;
    footer?: JSX.Element;
    testId?: string;
    className?: string;
}

export default function IconMessage(props: Props) {
    const {
        icon,
        error,
        formattedButtonText,
        formattedTertiaryButonText,
        formattedTitle,
        formattedSubtitle,
        formattedLinkText,
        buttonHandler,
        tertiaryButtonHandler,
        footer,
        testId,
        className,
    } = props;

    let button = null;
    if (formattedButtonText && buttonHandler) {
        button = (
            <div className={classNames('IconMessage-button', error ? 'error' : '')}>
                <button
                    className='btn btn-primary Form-btn'
                    onClick={buttonHandler}
                >
                    {formattedButtonText}
                </button>
            </div>
        );
    }

    let tertiaryBtn = null;
    if (formattedTertiaryButonText && tertiaryButtonHandler) {
        tertiaryBtn = (
            <div className={classNames('IconMessage-tertiary-button', error ? 'error' : '')}>
                <button
                    className='btn Form-btn'
                    onClick={tertiaryButtonHandler}
                >
                    {formattedTertiaryButonText}
                </button>
            </div>
        );
    }

    let link = null;
    if (formattedLinkText) {
        link = (
            <div className='IconMessage-link'>
                {formattedLinkText}
            </div>
        );
    }
    const withTestId: {'data-testid'?: string} = {};
    if (testId) {
        withTestId['data-testid'] = testId;
    }

    return (
        <div
            id='payment_complete_header'
            className='IconMessage'
            {...withTestId}
        >
            <div className={classNames('content', className || '')}>
                <div className='IconMessage__svg-wrapper'>
                    {icon}
                </div>
                <h3 className='IconMessage-h3'>
                    {formattedTitle || null}
                </h3>
                <div className={classNames('IconMessage-sub', error || '')}>
                    {formattedSubtitle || null}
                </div>
                <div className='IconMessage-buttons'>
                    {tertiaryBtn}
                    {button}
                </div>
                {link}
                {footer}
            </div>
        </div>
    );
}

IconMessage.defaultProps = {
    error: false,
    subtitle: '',
    date: '',
    className: '',
};
