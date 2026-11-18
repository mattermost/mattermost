// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

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
    readOnly?: boolean;
    helpText?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlur?: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

    /** The input's testid scope; its parts render `<testIdScope>.label--text`, `<testIdScope>.value--textbox`, `<testIdScope>.edit--button`, `<testIdScope>.help--text` and `<testIdScope>.error--alert`. */
    testIdScope?: string;
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
    readOnly,
    helpText,
    onChange,
    onBlur,
    testIdScope,
}: URLInputProps) {
    const {formatMessage} = useIntl();

    const [editing, setEditing] = useState(false);

    useEffect(() => {
        if (error) {
            setEditing(true);
        }
    }, [error]);

    const hasError = Boolean(error);
    const isEditing = !readOnly && (editing || hasError);

    const fullPath = `${base}/${path ? `${path}/` : ''}`;
    const fullURL = `${fullPath}${isEditing ? '' : pathInfo}`;
    const isShortenedURL = shortenLength && fullURL.length > shortenLength;

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

    const handlePropagateKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter') {
            event.stopPropagation();
        }
    };
    const urlInputLabel = (
        <span
            className='url-input-label'
            data-testid={testIdScope ? `${testIdScope}.label--text` : 'urlInputLabel'}
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
                {isEditing && (
                    <Input
                        data-testid={testIdScope ? `${testIdScope}.value--textbox` : 'channelURLInput'}
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
                        aria-describedby='url-input-error'
                    />
                )}
                {!readOnly && (
                    <Button
                        className={classNames('url-input-button', {disabled: hasError})}
                        disabled={hasError}
                        emphasis='quaternary'
                        size='x-small'
                        type='button'
                        data-testid={testIdScope ? `${testIdScope}.edit--button` : undefined}
                        onClick={handleOnButtonClick}
                        onKeyDown={handlePropagateKeyDown}
                    >
                        <span className='url-input-button-label'>
                            {editing ? formatMessage({id: 'url_input.buttonLabel.done', defaultMessage: 'Done'}) : formatMessage({id: 'url_input.buttonLabel.edit', defaultMessage: 'Edit'})}
                        </span>
                    </Button>
                )}
            </div>
            {helpText && (
                <div
                    className='url-input-help-text'
                    data-testid={testIdScope ? `${testIdScope}.help--text` : undefined}
                >
                    {helpText}
                </div>
            )}
            {error && (
                <div className='url-input-error'>
                    <i className='icon icon-alert-outline'/>
                    <span
                        id='url-input-error'
                        role='alert'
                        data-testid={testIdScope ? `${testIdScope}.error--alert` : undefined}
                    >
                        {error}
                    </span>
                </div>
            )}
        </div>
    );
}

export default UrlInput;
