// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

type Props = {
    previewMessageLink?: string;
    hasText?: boolean;
    hasExceededCharacterLimit?: boolean;
    currentLocale: string;
};

function TextboxLinks({
    previewMessageLink,
    hasText = false,
    hasExceededCharacterLimit = false,
    currentLocale,

}: Props) {

    let editHeader;

    let helpTextClass = '';

    if (hasExceededCharacterLimit) {
        helpTextClass = 'hidden';
    }

    if (previewMessageLink) {
        editHeader = (
            <span>
                {previewMessageLink}
            </span>
        );
    } else {
        editHeader = (
            <FormattedMessage
                id='textbox.edit'
                defaultMessage='Edit message'
            />
        );
    }

    const helpText = (
        <div
            style={{visibility: hasText ? 'visible' : 'hidden', opacity: hasText ? '0.45' : '0'}}
            className='help__format-text'
        >
            <b>
                <FormattedMessage
                    id='textbox.bold'
                    defaultMessage='**bold**'
                />
            </b>
            <i>
                <FormattedMessage
                    id='textbox.italic'
                    defaultMessage='*italic*'
                />
            </i>
            <span>
                {'~~'}
                <s>
                    <FormattedMessage
                        id='textbox.strike'
                        defaultMessage='strike'
                    />
                </s>
                {'~~ '}
            </span>
            <span>
                <FormattedMessage
                    id='textbox.inlinecode'
                    defaultMessage='`inline code`'
                />
            </span>
            <span>
                <FormattedMessage
                    id='textbox.preformatted'
                    defaultMessage='```preformatted```'
                />
            </span>
            <span>
                <FormattedMessage
                    id='textbox.quote'
                    defaultMessage='>quote'
                />
            </span>
        </div>
    );

    return (
        <div className={'help__text ' + helpTextClass}>
            {helpText}
            <Link
                target='_blank'
                rel='noopener noreferrer'
                to={`/help/messaging?locale=${currentLocale}`}
                className='textbox-help-link'
            >
                <FormattedMessage
                    id='textbox.help'
                    defaultMessage='Help'
                />
            </Link>
        </div>
    );
}

export default TextboxLinks;
