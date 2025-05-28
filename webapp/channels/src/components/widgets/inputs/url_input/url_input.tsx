// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import {getShortenedURL} from 'utils/url';

import Input from '../input/input';

import './url_input.scss';

type URLInputProps = {
    base: string;
    path?: string;
    pathInfo: string;
    limit?: number;
    maxLength?: number;
    shortenLength?: number;
    error?: string;
    className?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlur?: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

function UrlInput({
    base,
    path,
    pathInfo,
    limit,
    maxLength,
    shortenLength,
    error,
    className,
    onChange,
    onBlur,
}: URLInputProps) {
    const {formatMessage} = useIntl();

    const [editing, setEditing] = useState(false);

    useEffect(() => {
        if (error) {
            setEditing(true);
        }
    }, [error]);

    const fullPath = `${base}/${path ? `${path}/` : ''}`;
    const fullURL = `${fullPath}${editing ? '' : pathInfo}`;
    const isShortenedURL = shortenLength && fullURL.length > shortenLength;
    const hasError = Boolean(error);

    const handleOnInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        event.preventDefault();

        if (onChange) {
            onChange(event);
        }
    };

    const handleOnInputBlur = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        event.preventDefault();

        setEditing(hasError);

        if (onBlur) {
            onBlur(event);
        }
    };

    const handleOnButtonClick = () => {
        if (!hasError) {
            setEditing(!editing);
        }
    };

    const urlInputLabel = (
        <span
            className='url-input-label'
            data-testid='urlInputLabel'
        >
            {formatMessage({id: 'url_input.label.url', defaultMessage: 'URL: '})}
            {isShortenedURL ? getShortenedURL(fullURL, shortenLength) : fullURL}
        </span>
    );

    return (
        <div className={classNames('url-input-main', className)}>
            <div className='url-input-container'>
                {isShortenedURL ? (
                    <WithTooltip
                        title={fullURL}
                    >
                        {urlInputLabel}
                    </WithTooltip>

                ) : (
                    urlInputLabel
                )}
                {(editing || hasError) && (
                    <Input
                        data-testid='channelURLInput'
                        name='url-input'
                        type='text'
                        containerClassName='url-input-editable-container'
                        wrapperClassName='url-input-editable-wrapper'
                        inputClassName='url-input-editable-path'
                        autoFocus={true}
                        autoComplete='off'
                        value={pathInfo}
                        limit={limit}
                        maxLength={maxLength}
                        hasError={hasError}
                        onChange={handleOnInputChange}
                        onBlur={handleOnInputBlur}
                    />
                )}
                <button
                    className={classNames('url-input-button', {disabled: hasError})}
                    disabled={hasError}
                    onClick={handleOnButtonClick}
                >
                    <span className='url-input-button-label'>
                        {editing ? formatMessage({id: 'url_input.buttonLabel.done', defaultMessage: 'Done'}) : formatMessage({id: 'url_input.buttonLabel.edit', defaultMessage: 'Edit'})}
                    </span>
                </button>
            </div>
            {error && (
                <div className='url-input-error'>
                    <i className='icon icon-alert-outline'/>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}

export default UrlInput;
