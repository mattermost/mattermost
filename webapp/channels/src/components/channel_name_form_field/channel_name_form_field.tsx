// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Team} from '@mattermost/types/teams';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';
import Input from 'components/widgets/inputs/input/input';
import URLInput from 'components/widgets/inputs/url_input/url_input';

import Constants from 'utils/constants';
import {cleanUpUrlable, getSiteURL, validateChannelUrl} from 'utils/url';
import {generateSlug, localizeMessage} from 'utils/utils';

export type Props = {
    value: string;
    name: string;
    placeholder: string;
    onDisplayNameChange: (name: string) => void;
    onURLChange: (url: string) => void;
    autoFocus?: boolean;
    onErrorStateChange?: (isError: boolean) => void;
    team?: Team;
    urlError?: string;
}

import './channel_name_form_field.scss';

function validateDisplayName(displayNameParam: string) {
    const errors: string[] = [];

    const displayName = displayNameParam.trim();

    if (displayName.length < Constants.MIN_CHANNELNAME_LENGTH) {
        errors.push(localizeMessage('channel_modal.name.longer', 'Channel names must have at least 2 characters.'));
    }

    if (displayName.length > Constants.MAX_CHANNELNAME_LENGTH) {
        errors.push(localizeMessage('channel_modal.name.shorter', 'Channel names must have maximum 64 characters.'));
    }

    return errors;
}

// Component for input fields for editing channel display name
// along with stuff to edit its URL.
const ChannelNameFormField = (props: Props): JSX.Element => {
    const intl = useIntl();
    const {formatMessage} = intl;

    const displayNameModified = useRef<boolean>(false);
    const [displayNameError, setDisplayNameError] = useState<string>('');
    const displayName = useRef<string>('');
    const urlModified = useRef<boolean>(false);
    const [url, setURL] = useState<string>('');
    const [urlError, setURLError] = useState<string>('');
    const [inputCustomMessage, setInputCustomMessage] = useState<CustomMessageInputType | null>(null);

    const {name: currentTeamName} = useSelector(getCurrentTeam);
    const teamName = props.team ? props.team.name : currentTeamName;

    const handleOnDisplayNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        const {target: {value: updatedDisplayName}} = e;

        const displayNameErrors = validateDisplayName(updatedDisplayName);

        // set error if any, else clear it
        setDisplayNameError(displayNameErrors.length ? displayNameErrors[displayNameErrors.length - 1] : '');
        displayName.current = updatedDisplayName;
        props.onDisplayNameChange(updatedDisplayName);

        if (!urlModified.current) {
            // if URL isn't explicitly modified, it's derived from the display name
            const cleanURL = cleanUpUrlable(updatedDisplayName);
            setURL(cleanURL);
            setURLError('');
            props.onURLChange(cleanURL);
        }
    }, [props.onDisplayNameChange, props.onURLChange]);

    const handleOnDisplayNameBlur = useCallback(() => {
        if (displayName.current && !url) {
            const url = generateSlug();
            setURL(url);
            props.onURLChange(url);
        }
        if (!displayNameModified.current) {
            displayNameModified.current = true;
            setInputCustomMessage(null);
        }
    }, [props.onURLChange, displayName.current, url, displayNameModified]);

    const handleOnURLChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.preventDefault();
        const {target: {value: url}} = e;

        const cleanURL = url.toLowerCase().replace(/\s/g, '-');
        const urlErrors = validateChannelUrl(cleanURL, intl) as string[];

        setURLError(urlErrors.length ? urlErrors[urlErrors.length - 1] : '');
        setURL(cleanURL);
        urlModified.current = true;
        props.onURLChange(cleanURL);
    }, [props.onURLChange]);

    useEffect(() => {
        if (props.onErrorStateChange) {
            props.onErrorStateChange(Boolean(displayNameError) || Boolean(urlError));
        }
    }, [displayNameError, urlError]);

    return (
        <React.Fragment>
            <Input
                type='text'
                autoComplete='off'
                autoFocus={props.autoFocus !== false}
                required={true}
                name={props.name}
                containerClassName={`${props.name}-container`}
                inputClassName={`${props.name}-input channel-name-input-field`}
                label={formatMessage({id: 'channel_modal.name.label', defaultMessage: 'Channel name'})}
                placeholder={props.placeholder}
                limit={Constants.MAX_CHANNELNAME_LENGTH}
                value={props.value}
                customMessage={inputCustomMessage}
                onChange={handleOnDisplayNameChange}
                onBlur={handleOnDisplayNameBlur}
            />
            <URLInput
                className='new-channel-modal__url'
                base={getSiteURL()}
                path={`${teamName}/channels`}
                pathInfo={url}
                limit={Constants.MAX_CHANNELNAME_LENGTH}
                shortenLength={Constants.DEFAULT_CHANNELURL_SHORTEN_LENGTH}
                error={urlError || props.urlError}
                onChange={handleOnURLChange}
            />
        </React.Fragment>
    );
};

export default ChannelNameFormField;
