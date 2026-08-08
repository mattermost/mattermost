// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {IntlShape} from 'react-intl';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Team} from '@mattermost/types/teams';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {isAnonymousURLEnabled} from 'selectors/config';

import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';
import Input from 'components/widgets/inputs/input/input';
import URLInput from 'components/widgets/inputs/url_input/url_input';

import Constants from 'utils/constants';
import {cleanUpUrlable, getSiteURL, validateChannelUrl} from 'utils/url';
import {generateSlug} from 'utils/utils';

export type Props = {
    value: string;
    name: string;
    placeholder: string;
    onDisplayNameChange: (name: string) => void;
    onURLChange: (url: string) => void;
    currentUrl?: string;
    autoFocus?: boolean;
    onErrorStateChange?: (isError: boolean, errorMessage?: string) => void;
    team?: Team;
    urlError?: string;
    readOnly?: boolean;
    isEditingExistingChannel?: boolean;
};

import './channel_name_form_field.scss';

function validateDisplayName(intl: IntlShape, displayNameParam: string) {
    const errors: string[] = [];

    const displayName = displayNameParam.trim();

    if (displayName.length < Constants.MIN_CHANNELNAME_LENGTH) {
        errors.push(intl.formatMessage({id: 'channel_modal.name.longer', defaultMessage: 'Channel names must have at least 1 character.'}));
    }

    if (displayName.length > Constants.MAX_CHANNELNAME_LENGTH) {
        errors.push(intl.formatMessage({id: 'channel_modal.name.shorter', defaultMessage: 'Channel names must have maximum 64 characters.'}));
    }

    return errors;
}

function applyDisplayNameErrors(
    intl: IntlShape,
    name: string,
    setDisplayNameError: (error: string) => void,
    setInputCustomMessage: (message: CustomMessageInputType | null) => void,
) {
    const displayNameErrors = validateDisplayName(intl, name);
    const lastError = displayNameErrors.length ? displayNameErrors[displayNameErrors.length - 1] : '';
    setDisplayNameError(lastError);
    setInputCustomMessage(lastError ? {type: 'error', value: lastError} : null);
    return displayNameErrors;
}

// Component for input fields for editing channel display name
// along with stuff to edit its URL.
const ChannelNameFormField = (props: Props): JSX.Element => {
    const intl = useIntl();
    const {formatMessage} = intl;
    const useAnonymousURLs = useSelector(isAnonymousURLEnabled);

    // Track if the field has been interacted with
    const [hasInteracted, setHasInteracted] = useState(false);
    const [displayNameError, setDisplayNameError] = useState<string>('');

    // True only after the user edits the name — used so autofocus→blur into another
    // control (e.g. category clear) cannot leave a sticky empty-name error.
    const hasEditedName = useRef(false);
    const displayName = useRef<string>(props.value);
    const urlModified = useRef<boolean>(false);
    const [url, setURL] = useState<string>(props.currentUrl || '');
    const [urlError, setURLError] = useState<string>('');
    const [inputCustomMessage, setInputCustomMessage] = useState<CustomMessageInputType | null>(null);

    // Keep the ref in sync and clear sticky false-positive errors when value is valid.
    useEffect(() => {
        displayName.current = props.value;
        if (displayNameError && validateDisplayName(intl, props.value).length === 0) {
            setDisplayNameError('');
            setInputCustomMessage(null);
        }
    }, [props.value, displayNameError, intl]);

    const currentTeamName = useSelector(getCurrentTeam)?.name;
    const teamName = props.team ? props.team.name : currentTeamName;

    const handleOnDisplayNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        const {target: {value: updatedDisplayName}} = e;

        hasEditedName.current = true;

        // Mark as interacted when user types
        if (!hasInteracted && updatedDisplayName.trim() !== '') {
            setHasInteracted(true);
        }

        // Only validate if the user has interacted with the field
        if (hasInteracted) {
            applyDisplayNameErrors(intl, updatedDisplayName, setDisplayNameError, setInputCustomMessage);
        }

        displayName.current = updatedDisplayName;
        props.onDisplayNameChange(updatedDisplayName);

        if (!urlModified.current && !props.isEditingExistingChannel) {
            // Only auto-generate URL for new channels, not when editing existing ones
            const cleanURL = cleanUpUrlable(updatedDisplayName);
            setURL(cleanURL);
            setURLError('');
            props.onURLChange(cleanURL);
        }
    }, [props.onDisplayNameChange, props.onURLChange, props.isEditingExistingChannel, hasInteracted, intl]);

    const handleOnDisplayNameBlur = useCallback((event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        // Prefer the DOM value so validation matches what the input shows
        const nameForValidation = event.currentTarget.value || props.value || displayName.current;
        displayName.current = nameForValidation;

        // Editing an existing channel: ignore blur until the user edits the name.
        // Autofocus + clicking category clear was falsely flagging an empty name.
        if (props.isEditingExistingChannel && !hasEditedName.current) {
            return;
        }

        setHasInteracted(true);
        applyDisplayNameErrors(intl, nameForValidation, setDisplayNameError, setInputCustomMessage);

        // Handle URL generation if needed
        if (nameForValidation && !url) {
            const generatedURL = generateSlug();
            setURL(generatedURL);
            props.onURLChange(generatedURL);
        }
    }, [props.onURLChange, props.value, props.isEditingExistingChannel, url, intl]);

    const handleOnURLChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.preventDefault();
        const {target: {value: url}} = e;

        const cleanURL = url.toLowerCase().replace(/\s/g, '-');
        const urlErrors = validateChannelUrl(cleanURL, intl) as string[];

        setURLError(urlErrors.length ? urlErrors[urlErrors.length - 1] : '');
        setURL(cleanURL);
        urlModified.current = true;
        props.onURLChange(cleanURL);
    }, [props.onURLChange, intl]);

    // Add a URL blur handler to validate the URL when the user moves away from the field
    const handleOnURLBlur = useCallback(() => {
        // Only validate if the URL has been modified
        if (urlModified.current) {
            const urlErrors = validateChannelUrl(url, intl);
            let lastError = '';
            if (urlErrors.length && typeof urlErrors[urlErrors.length - 1] === 'string') {
                // Safe to assert as string because we're always providing intl to validateChannelUrl and have extra type safe check
                lastError = urlErrors[urlErrors.length - 1] as string;
            }
            setURLError(lastError);
        }
    }, [url, intl]);

    useEffect(() => {
        // Only report URL errors if the URL has been explicitly modified and validated
        // This prevents showing errors during typing
        if (props.onErrorStateChange) {
            if (displayNameError) {
                props.onErrorStateChange(true, displayNameError);
            } else if (urlModified.current && urlError) {
                props.onErrorStateChange(true, urlError);
            } else {
                props.onErrorStateChange(false, '');
            }
        }
    }, [displayNameError, urlError]);

    // Effect to set URL from props if it's modified (used in modals for reset button event which sets the value outside the onChange event)
    useEffect(() => {
        if (props.currentUrl) {
            setURL(props.currentUrl);
        }
    }, [props.currentUrl]);

    const showURLEditor = props.isEditingExistingChannel || !useAnonymousURLs;

    // Existing-channel edit: do not autofocus the name field (avoids blur races when
    // interacting with other controls). New-channel flows keep default autofocus.
    const shouldAutoFocus = props.isEditingExistingChannel ? props.autoFocus === true : props.autoFocus !== false;

    return (
        <>
            <Input
                type='text'
                autoComplete='off'
                autoFocus={shouldAutoFocus}
                required={true}
                name={props.name}
                containerClassName={`${props.name}-container`}
                inputClassName={`${props.name}-input channel-name-input-field`}
                label={formatMessage({id: 'channel_modal.name.label', defaultMessage: 'Channel name'})}
                placeholder={props.placeholder}
                limit={Constants.MAX_CHANNELNAME_LENGTH}

                // Only pass minLength after the user has interacted with the field
                minLength={hasInteracted ? Constants.MIN_CHANNELNAME_LENGTH : undefined}
                value={props.value}
                customMessage={inputCustomMessage}
                onChange={handleOnDisplayNameChange}
                onBlur={handleOnDisplayNameBlur}
                disabled={props.readOnly}
            />
            {
                showURLEditor &&
                <URLInput
                    className='new-channel-modal__url'
                    base={getSiteURL()}
                    path={`${teamName}/channels`}
                    pathInfo={url}
                    limit={Constants.MAX_CHANNELNAME_LENGTH}
                    shortenLength={Constants.DEFAULT_CHANNELURL_SHORTEN_LENGTH}
                    error={urlError || props.urlError}
                    onChange={handleOnURLChange}
                    onBlur={handleOnURLBlur}
                />
            }
        </>
    );
};

export default ChannelNameFormField;
