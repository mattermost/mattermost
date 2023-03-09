// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';
import {FormattedMessage} from 'react-intl';

import './icon_message.scss';

type Props = {
    icon: JSX.Element;
    title?: string;
    subtitle?: string;
    date?: string;
    error?: boolean;
    buttonText?: string;
    tertiaryBtnText?: string;
    formattedButtonText?: JSX.Element;
    formattedLinkText?: React.ReactNode;
    formattedTertiaryButonText?: JSX.Element;
    formattedTitle?: JSX.Element;
    formattedSubtitle?: React.ReactNode;
    buttonHandler?: () => void;
    tertiaryButtonHandler?: () => void;
    linkText?: string;
    linkURL?: string;
    footer?: JSX.Element;
    testId?: string;
    className?: string;
}

export default function IconMessage(props: Props) {
    const {
        icon,
        title,
        subtitle,
        date,
        error,
        buttonText,
        tertiaryBtnText,
        formattedButtonText,
        formattedTertiaryButonText,
        formattedTitle,
        formattedSubtitle,
        formattedLinkText,
        buttonHandler,
        tertiaryButtonHandler,
        linkText,
        linkURL,
        footer,
        testId,
        className,
    } = props;

    let button = null;
    if ((buttonText || formattedButtonText) && buttonHandler) {
        button = (
            <div className={classNames('IconMessage-button', error ? 'error' : '')}>
                <button
                    className='btn btn-primary Form-btn'
                    onClick={buttonHandler}
                >
                    {formattedButtonText || <FormattedMessage id={buttonText}/>}
                </button>
            </div>
        );
    }

    let tertiaryBtn = null;
    if ((tertiaryBtnText || formattedTertiaryButonText) && tertiaryButtonHandler) {
        tertiaryBtn = (
            <div className={classNames('IconMessage-tertiary-button', error ? 'error' : '')}>
                <button
                    className='btn Form-btn'
                    onClick={tertiaryButtonHandler}
                >
                    {formattedTertiaryButonText || <FormattedMessage id={tertiaryBtnText}/>}
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
    } else if (linkText && linkURL) {
        link = (
            <div className='IconMessage-link'>
                <a
                    href={linkURL}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    <FormattedMessage
                        id={linkText}
                    />
                </a>
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
                    {title ? <FormattedMessage id={title}/> : null}
                    {formattedTitle || null}
                </h3>
                <div className={classNames('IconMessage-sub', error || '')}>
                    {subtitle ? (
                        <FormattedMessage
                            id={subtitle}
                            values={{date}}
                        />
                    ) : null}
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
