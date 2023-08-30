// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Input from 'components/widgets/inputs/input/input';
import Constants, {ItemStatus} from 'utils/constants';
import React, {useState} from 'react';
import {cleanUpUrlable, getSiteURL, validateChannelUrl} from 'utils/url';
import {validateDisplayName} from 'components/new_channel_modal/new_channel_modal';
import crypto from 'crypto';
import URLInput from 'components/widgets/inputs/url_input/url_input';
import {useSelector} from 'react-redux';
import {GlobalState} from 'types/store';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {useIntl} from 'react-intl';

export type Props = {
    value: string;
    name: string;
    placeholder: string;
    onDisplayNameChange: (name: string) => void;
    onURLChange: (url: string) => void;
    autoFocus?: boolean;
}

import './channel_name_form_field.scss';

// Component for input fields for editing channel display name
// along with stuff to edit its URL.
const ChannelNameFormField = (props: Props): JSX.Element => {
    const {value, name, placeholder, onDisplayNameChange, onURLChange} = props;

    const intl = useIntl();
    const {formatMessage} = intl;
    const [displayNameModified, setDisplayNameModified] = useState<boolean>(false);
    const [displayNameError, setDisplayNameError] = useState<string>('');
    const [displayName, setDisplayName] = useState<string>('');
    const [urlModified, setURLModified] = useState<boolean>(false);
    const [url, setURL] = useState<string>('');
    const [urlError, setURLError] = useState<string>('');

    const {name: currentTeamName} = useSelector((state: GlobalState) => getCurrentTeam(state));

    const handleOnDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        const {target: {value: displayName}} = e;

        const displayNameErrors = validateDisplayName(displayName);

        // set error if any, else clear it
        setDisplayNameError(displayNameErrors.length ? displayNameErrors[displayNameErrors.length - 1] : '');
        setDisplayName(displayName);
        onDisplayNameChange(displayName);

        if (!urlModified) {
            // if URL isn't explicitly modified, it's derived from the display name

            const cleanURL = cleanUpUrlable(displayName);
            setURL(cleanURL);
            setURLError('');
            onURLChange(cleanURL);
        }
    };

    const handleOnDisplayNameBlur = () => {
        if (displayName && !url) {
            setURL(crypto.randomBytes(16).toString('hex'));
        }
        if (!displayNameModified) {
            setDisplayNameModified(true);
        }
    };

    const handleOnURLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        const {target: {value: url}} = e;

        const cleanURL = url.toLowerCase().replace(/\s/g, '-');
        const urlErrors = validateChannelUrl(cleanURL, intl) as string[];

        setURLError(urlErrors.length ? urlErrors[urlErrors.length - 1] : '');
        setURL(cleanURL);
        setURLModified(true);
        onURLChange(cleanURL);
    };

    return (
        <React.Fragment>
            <Input
                type='text'
                autoComplete='off'
                autoFocus={props.autoFocus !== false}
                required={true}
                name={name}
                containerClassName={`${name}-container`}
                inputClassName={`${name}-input channel-name-input-field`}
                label={formatMessage({id: 'channel_modal.name.label', defaultMessage: 'Channel name'})}
                placeholder={placeholder}
                limit={Constants.MAX_CHANNELNAME_LENGTH}
                value={value}
                customMessage={displayNameModified ? {type: ItemStatus.ERROR, value: displayNameError} : null}
                onChange={handleOnDisplayNameChange}
                onBlur={handleOnDisplayNameBlur}
            />
            <URLInput
                className='new-channel-modal__url'
                base={getSiteURL()}
                path={`${currentTeamName}/channels`}
                pathInfo={url}
                limit={Constants.MAX_CHANNELNAME_LENGTH}
                shortenLength={Constants.DEFAULT_CHANNELURL_SHORTEN_LENGTH}
                error={urlError}
                onChange={handleOnURLChange}
            />
        </React.Fragment>

    );
};

export default ChannelNameFormField;
