// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {clearErrors, logError} from 'mattermost-redux/actions/errors';
import {updateMe} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {AnnouncementBarMessages, AnnouncementBarTypes} from 'utils/constants';

import EmailSection from './email_section';
import {holders} from './messages';
import NameSection from './name_section';
import NicknameSection from './nickname_section';
import PictureSection from './picture_section';
import PositionSection from './position_section';
import UsernameSection from './username_section';

import SettingDesktopHeader from '../headers/setting_desktop_header';
import SettingMobileHeader from '../headers/setting_mobile_header';

type Props = {
    user: UserProfile;
    updateSection: (section: string) => void;
    updateTab: (notifications: string) => void;
    activeSection?: string;
    closeModal: () => void;
    collapseModal: () => void;
}

const UserSettingsGeneralTab = ({
    closeModal,
    collapseModal,
    updateSection: updateSectionProp,
    updateTab,
    user,
    activeSection = '',
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const submitActive = useRef(false);
    const [username, setUsername] = useState(user.username);
    const [firstName, setFirstName] = useState(user.first_name);
    const [lastName, setLastName] = useState(user.last_name);
    const [nickname, setNickname] = useState(user.nickname);
    const [position, setPosition] = useState(user.position);
    const [originalEmail, setOriginalEmail] = useState(user.email);
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [pictureFile, setPictureFile] = useState<File>();
    const [loadingPicture, setLoadingPicture] = useState(false);
    const [sectionIsSaving, setSectionIsSaving] = useState(false);
    const [clientError, setClientError] = useState('');
    const [serverError, setServerError] = useState('');
    const [emailError, setEmailError] = useState('');

    const requireEmailVerification = useSelector((state: GlobalState) => getConfig(state).RequireEmailVerification === 'true');

    const resetState = useCallback(() => {
        setUsername(user.username);
        setFirstName(user.first_name);
        setLastName(user.last_name);
        setNickname(user.nickname);
        setPosition(user.position);
        setOriginalEmail(user.email);
        setEmail('');
        setConfirmEmail('');
        setCurrentPassword('');
        setPictureFile(undefined);
        setLoadingPicture(false);
        setSectionIsSaving(false);
        setServerError('');
    }, [user.email, user.first_name, user.last_name, user.nickname, user.position, user.username]);

    const updateSection = useCallback((section: string) => {
        resetState();
        setClientError('');
        setServerError('');
        setEmailError('');
        setSectionIsSaving(false);

        submitActive.current = false;
        updateSectionProp(section);
    }, [resetState, updateSectionProp]);

    const submitUser = useCallback((user: UserProfile, emailUpdated: boolean) => {
        setSectionIsSaving(true);

        dispatch(updateMe(user)).
            then(({data, error: err}) => {
                if (data) {
                    updateSection('');

                    const verificationEnabled = requireEmailVerification && emailUpdated;
                    if (verificationEnabled) {
                        dispatch(clearErrors());
                        dispatch(logError({
                            message: AnnouncementBarMessages.EMAIL_VERIFICATION_REQUIRED,
                            type: AnnouncementBarTypes.SUCCESS,
                        }, true));
                    }
                } else if (err) {
                    let serverError;
                    if (err.server_error_id &&
                        err.server_error_id === 'api.user.check_user_password.invalid.app_error') {
                        serverError = formatMessage(holders.incorrectPassword);
                    } else if (err.server_error_id === 'app.user.group_name_conflict') {
                        serverError = formatMessage(holders.usernameGroupNameUniqueness);
                    } else if (err.message) {
                        serverError = err.message;
                    } else {
                        serverError = err;
                    }
                    setServerError(serverError);
                    setEmailError('');
                    setClientError('');
                    setSectionIsSaving(false);
                }
            });
    }, [dispatch, formatMessage, requireEmailVerification, updateSection]);

    const nameSection = (
        <NameSection
            activeSection={activeSection}
            clientError={clientError}
            firstName={firstName}
            lastName={lastName}
            sectionIsSaving={sectionIsSaving}
            serverError={serverError}
            setFirstName={setFirstName}
            setLastName={setLastName}
            submitUser={submitUser}
            updateSection={updateSection}
            updateTab={updateTab}
            user={user}
        />
    );

    const nicknameSection = (
        <NicknameSection
            activeSection={activeSection}
            clientError={clientError}
            nickname={nickname}
            sectionIsSaving={sectionIsSaving}
            serverError={serverError}
            setNickname={setNickname}
            submitUser={submitUser}
            updateSection={updateSection}
            user={user}
        />
    );

    const usernameSection = (
        <UsernameSection
            activeSection={activeSection}
            clientError={clientError}
            sectionIsSaving={sectionIsSaving}
            serverError={serverError}
            setClientError={setClientError}
            setServerError={setServerError}
            setUsername={setUsername}
            submitUser={submitUser}
            updateSection={updateSection}
            user={user}
            username={username}
        />
    );

    const positionSection = (
        <PositionSection
            activeSection={activeSection}
            clientError={clientError}
            position={position}
            sectionIsSaving={sectionIsSaving}
            serverError={serverError}
            setPosition={setPosition}
            submitUser={submitUser}
            updateSection={updateSection}
            user={user}
        />
    );

    const emailSection = (
        <EmailSection
            activeSection={activeSection}
            confirmEmail={confirmEmail}
            currentPassword={currentPassword}
            email={email}
            emailError={emailError}
            originalEmail={originalEmail}
            requireEmailVerification={requireEmailVerification}
            sectionIsSaving={sectionIsSaving}
            serverError={serverError}
            setClientError={setClientError}
            setConfirmEmail={setConfirmEmail}
            setCurrentPassword={setCurrentPassword}
            setEmail={setEmail}
            setEmailError={setEmailError}
            setServerError={setServerError}
            submitUser={submitUser}
            updateSection={updateSection}
            user={user}
        />
    );
    const pictureSection = (
        <PictureSection
            activeSection={activeSection}
            clientError={clientError}
            loadingPicture={loadingPicture}
            pictureFile={pictureFile}
            serverError={serverError}
            setClientError={setClientError}
            setEmailError={setEmailError}
            setInitialState={resetState}
            setLoadingPicture={setLoadingPicture}
            setPictureFile={setPictureFile}
            setSectionIsSaving={setSectionIsSaving}
            setServerError={setServerError}
            submitActive={submitActive}
            updateSection={updateSection}
            user={user}
        />
    );

    return (
        <div id='generalSettings'>
            <SettingMobileHeader
                closeModal={closeModal}
                collapseModal={collapseModal}
                text={
                    <FormattedMessage
                        id='user.settings.modal.profile'
                        defaultMessage='Profile'
                    />
                }
            />
            <div className='user-settings'>
                <SettingDesktopHeader
                    id='generalSettingsTitle'
                    text={
                        <FormattedMessage
                            id='user.settings.modal.profile'
                            defaultMessage='Profile'
                        />
                    }
                />
                <div className='divider-dark first'/>
                {nameSection}
                <div className='divider-light'/>
                {usernameSection}
                <div className='divider-light'/>
                {nicknameSection}
                <div className='divider-light'/>
                {positionSection}
                <div className='divider-light'/>
                {emailSection}
                <div className='divider-light'/>
                {pictureSection}
                <div className='divider-dark'/>
            </div>
        </div>
    );
};

export default UserSettingsGeneralTab;
