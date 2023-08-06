// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

type Props = {
    // showPreview?: boolean;
    previewMessageLink?: string;
    hasText?: boolean;
    hasExceededCharacterLimit?: boolean;
    currentLocale: string;
    // updatePreview?: (showPreview: boolean) => void;
};

function TextboxLinks({
    // showPreview,
    previewMessageLink,
    hasText = false,
    hasExceededCharacterLimit = false,
    currentLocale,
    // updatePreview,
}: Props) {
    // const togglePreview = (e: MouseEvent) => {
    //     e.preventDefault();
    //     updatePreview?.(!showPreview);
    // };

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

    // let previewLink = null;
    // if (isMarkdownPreviewEnabled) {
    //     previewLink = (
    //         <button
    //             id='previewLink'
    //             onClick={togglePreview}
    //             className='style--none textbox-preview-link color--link'
    //         >
    //             {showPreview ? (
    //                 editHeader
    //             ) : (
    //                 <FormattedMessage
    //                     id='textbox.preview'
    //                     defaultMessage='Preview'
    //                 />
    //             )}
    //         </button>
    //     );
    // }

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
            {/* {previewLink} */}
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
