// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import classNames from 'classnames';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import Input from '../input/input';

import Constants from 'utils/constants';
import {getShortenedURL} from 'utils/url';

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
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (event: React.ChangeEvent<HTMLInputElement>) => void;
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

    const handleOnInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();

        if (onChange) {
            onChange(event);
        }
    };

    const handleOnInputBlur = (event: React.ChangeEvent<HTMLInputElement>) => {
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
        <span className='url-input-label'>
            {formatMessage({id: 'url_input.label.url', defaultMessage: 'URL: '})}
            {isShortenedURL ? getShortenedURL(fullURL, shortenLength) : fullURL}
        </span>
    );

    return (
        <div className={classNames('url-input-main', className)}>
            <div className='url-input-container'>
                {isShortenedURL ? (
                    <OverlayTrigger
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement='top'
                        overlay={(
                            <Tooltip id='urlTooltip'>
                                {fullURL}
                            </Tooltip>
                        )}
                    >
                        {urlInputLabel}
                    </OverlayTrigger>
                ) : (
                    urlInputLabel
                )}
                {(editing || hasError) && (
                    <Input
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
