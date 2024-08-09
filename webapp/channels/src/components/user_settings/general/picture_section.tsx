// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MutableRefObject} from 'react';
import React, {useCallback} from 'react';
import {FormattedDate, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {
    setDefaultProfileImage,
    uploadProfileImage,
} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import {getIsMobileView} from 'selectors/views/browser';

import SettingItem from 'components/setting_item';
import SettingPicture from 'components/setting_picture';

import {AcceptedProfileImageTypes, Constants} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import {holders} from './messages';

type Props = {
    user: UserProfile;
    activeSection: string;
    serverError: string;
    clientError: string;
    updateSection: (section: string) => void;
    pictureFile: File | undefined;
    submitActive: MutableRefObject<boolean>;
    loadingPicture: boolean;
    setClientError: (error: string) => void;
    setServerError: (error: string) => void;
    setLoadingPicture: (value: boolean) => void;
    setInitialState: () => void;
    setEmailError: (error: string) => void;
    setSectionIsSaving: (value: boolean) => void;
    setPictureFile: (file: File | undefined) => void;
}
const PictureSection = ({
    user,
    activeSection,
    serverError,
    clientError,
    updateSection,
    pictureFile,
    loadingPicture,
    submitActive,
    setClientError,
    setServerError,
    setLoadingPicture,
    setInitialState,
    setEmailError,
    setSectionIsSaving,
    setPictureFile,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const ldapPictureAttributeSet = useSelector((state: GlobalState) => getConfig(state).LdapPictureAttributeSet === 'true');
    const maxFileSize = useSelector((state: GlobalState) => parseInt(getConfig(state).MaxFileSize || '0', 10));
    const isMobileView = useSelector((state: GlobalState) => getIsMobileView(state));

    const updatePicture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPictureFile(e.target.files[0]);
            submitActive.current = true;
            setClientError('');
        } else {
            setPictureFile(undefined);
        }
    }, [setClientError, setPictureFile, submitActive]);

    const setDefaultProfilePicture = useCallback(async () => {
        try {
            await dispatch(setDefaultProfileImage(user.id));
            updateSection('');
            submitActive.current = false;
        } catch (err) {
            let serverError;
            if (err.message) {
                serverError = err.message;
            } else {
                serverError = err;
            }
            setServerError(serverError);
            setEmailError('');
            setClientError('');
            setSectionIsSaving(false);
        }
    }, [dispatch, setClientError, setEmailError, setSectionIsSaving, setServerError, submitActive, updateSection, user.id]);

    const submitPicture = useCallback(() => {
        if (!pictureFile) {
            return;
        }

        if (!submitActive.current) {
            return;
        }

        trackEvent('settings', 'user_settings_update', {field: 'picture'});

        const file = pictureFile;

        if (!AcceptedProfileImageTypes.includes(file.type)) {
            setClientError(formatMessage(holders.validImage));
            setServerError('');
            return;
        } else if (file.size > maxFileSize) {
            setClientError(formatMessage(holders.imageTooLarge));
            setServerError('');
            return;
        }

        setLoadingPicture(true);

        dispatch(uploadProfileImage(user.id, file)).
            then(({data, error: err}) => {
                if (data) {
                    updateSection('');
                    submitActive.current = false;
                } else if (err) {
                    setInitialState();
                    setServerError(err.message);
                }
            });
    }, [dispatch, formatMessage, maxFileSize, pictureFile, setClientError, setInitialState, setLoadingPicture, setServerError, submitActive, updateSection, user.id]);

    const active = activeSection === 'picture';
    let max = null;

    if (active) {
        let submit = null;
        let setDefault = null;
        let helpText = null;
        let imgSrc = null;

        if ((user.auth_service === Constants.LDAP_SERVICE || user.auth_service === Constants.SAML_SERVICE) && ldapPictureAttributeSet) {
            helpText = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.field_handled_externally'
                        defaultMessage='This field is handled through your login provider. If you want to change it, you need to do so through your login provider.'
                    />
                </span>
            );
        } else {
            submit = submitPicture;
            setDefault = user.last_picture_update > 0 ? setDefaultProfilePicture : null;
            imgSrc = Utils.imageURLForUser(user.id, user.last_picture_update);
            helpText = (
                <FormattedMessage
                    id='setting_picture.help.profile'
                    defaultMessage='Upload a picture in BMP, JPG, JPEG, or PNG format. Maximum file size: {max}'
                    values={{max: Utils.fileSizeToString(maxFileSize)}}
                />
            );
        }

        max = (
            <SettingPicture
                title={formatMessage(holders.profilePicture)}
                onSubmit={submit}
                onSetDefault={setDefault}
                src={imgSrc}
                defaultImageSrc={Utils.defaultImageURLForUser(user.id)}
                serverError={serverError}
                clientError={clientError}
                updateSection={(e: React.MouseEvent) => {
                    updateSection('');
                    e.preventDefault();
                }}
                file={pictureFile}
                onFileChange={updatePicture}
                submitActive={submitActive.current}
                loadingPicture={loadingPicture}
                maxFileSize={maxFileSize}
                helpText={helpText}
            />
        );
    }

    let minMessage: JSX.Element|string = formatMessage(holders.uploadImage);
    if (isMobileView) {
        minMessage = formatMessage(holders.uploadImageMobile);
    }
    if (user.last_picture_update > 0) {
        minMessage = (
            <FormattedMessage
                id='user.settings.general.imageUpdated'
                defaultMessage='Image last updated {date}'
                values={{
                    date: (
                        <FormattedDate
                            value={new Date(user.last_picture_update)}
                            day='2-digit'
                            month='short'
                            year='numeric'
                        />
                    ),
                }}
            />
        );
    }
    return (
        <SettingItem
            active={active}
            areAllSectionsInactive={activeSection === ''}
            title={formatMessage(holders.profilePicture)}
            describe={minMessage}
            section={'picture'}
            updateSection={updateSection}
            max={max}
        />
    );
};

export default PictureSection;
