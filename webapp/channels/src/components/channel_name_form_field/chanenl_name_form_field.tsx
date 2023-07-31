import Input from "components/widgets/inputs/input/input";
import Constants, {ItemStatus} from "utils/constants";
import React, {useState} from "react";
import {cleanUpUrlable, getSiteURL, validateChannelUrl} from "utils/url";
import {validateDisplayName} from "components/new_channel_modal/new_channel_modal";
import crypto from "crypto";
import URLInput from "components/widgets/inputs/url_input/url_input";
import {useSelector} from "react-redux";
import {GlobalState} from "types/store";
import {getCurrentTeam} from "mattermost-redux/selectors/entities/teams";
import {useIntl} from "react-intl";

export type Props = {
    value: string
    name: string
    placeholder: string
    onDisplayNameChange: (name: string) => void
    autoFocus?: boolean
}

import './channel_name_form_field.scss';
import {bool} from "yup";

const ChannelNameFormField = (props: Props): JSX.Element => {
    const {value, name, placeholder, onDisplayNameChange} = props;

    const intl = useIntl();
    const {formatMessage} = intl;

    const [displayNameModified, setDisplayNameModified] = useState(false);
    const [displayNameError, setDisplayNameError] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [serverError, setServerError] = useState('');
    const [urlModified, setURLModified] = useState(false);
    const [url, setURL] = useState('');
    const [urlError, setURLError] = useState('');

    const {id: currentTeamId, name: currentTeamName} = useSelector((state: GlobalState) => getCurrentTeam(state));

    const handleOnDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        const {target: {value: displayName}} = e;

        const displayNameErrors = validateDisplayName(displayName);

        setDisplayNameError(displayNameErrors.length ? displayNameErrors[displayNameErrors.length - 1] : '');
        setDisplayName(displayName);
        setServerError('');
        onDisplayNameChange(displayName);

        if (!urlModified) {
            setURL(cleanUpUrlable(displayName));
            setURLError('');
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
        setServerError('');
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
}

export default ChannelNameFormField;
