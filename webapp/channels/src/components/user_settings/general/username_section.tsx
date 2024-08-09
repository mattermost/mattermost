// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import {getIsMobileView} from 'selectors/views/browser';

import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';

import {Constants, ValidationErrors} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import {holders} from './messages';

type Props = {
    activeSection: string;
    user: UserProfile;
    username: string;
    setUsername: (value: string) => void;
    updateSection: (section: string) => void;
    submitUser: (user: UserProfile, emailUpdated: boolean) => void;
    serverError: string;
    clientError: string;
    sectionIsSaving: boolean;
    setServerError: (error: string) => void;
    setClientError: (error: string) => void;
};

const UsernameSection = ({
    activeSection,
    user,
    username,
    setUsername,
    updateSection,
    clientError,
    sectionIsSaving,
    serverError,
    submitUser,
    setClientError,
    setServerError,
}: Props) => {
    const {formatMessage} = useIntl();
    const isMobileView = useSelector((state: GlobalState) => getIsMobileView(state));

    const updateUsername = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setUsername(e.target.value);
    }, [setUsername]);

    const submitUsername = useCallback(() => {
        const patchedUser = Object.assign({}, user);
        const patchedUsername = username.trim().toLowerCase();

        const usernameError = Utils.isValidUsername(patchedUsername);
        if (usernameError) {
            setServerError('');
            if (usernameError.id === ValidationErrors.RESERVED_NAME) {
                setClientError(formatMessage(holders.usernameReserved));
            } else {
                setClientError(formatMessage(holders.usernameRestrictions, {min: Constants.MIN_USERNAME_LENGTH, max: Constants.MAX_USERNAME_LENGTH}));
            }
            return;
        }

        if (patchedUser.username === patchedUsername) {
            updateSection('');
            return;
        }

        patchedUser.username = patchedUsername;

        trackEvent('settings', 'user_settings_update', {field: 'username'});

        submitUser(patchedUser, false);
    }, [formatMessage, setClientError, setServerError, submitUser, updateSection, user, username]);

    const active = activeSection === 'username';
    let max = null;
    if (active) {
        const inputs = [];

        let extraInfo;
        let submit = null;
        if (user.auth_service === '') {
            let usernameLabel: JSX.Element | string = (
                <FormattedMessage
                    id='user.settings.general.username'
                    defaultMessage='Username'
                />
            );
            if (isMobileView) {
                usernameLabel = '';
            }

            inputs.push(
                <div
                    key='usernameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{usernameLabel}</label>
                    <div className='col-sm-7'>
                        <input
                            id='username'
                            autoFocus={true}
                            maxLength={Constants.MAX_USERNAME_LENGTH}
                            className='form-control'
                            type='text'
                            onChange={updateUsername}
                            value={username}
                            autoCapitalize='off'
                            onFocus={Utils.moveCursorToEnd}
                            aria-label={formatMessage({id: 'user.settings.general.username', defaultMessage: 'Username'})}
                        />
                    </div>
                </div>,
            );

            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.usernameInfo'
                        defaultMessage='Pick something easy for teammates to recognize and recall.'
                    />
                </span>
            );

            submit = submitUsername;
        } else {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.field_handled_externally'
                        defaultMessage='This field is handled through your login provider. If you want to change it, you need to do so through your login provider.'
                    />
                </span>
            );
        }

        max = (
            <SettingItemMax
                title={formatMessage(holders.username)}
                inputs={inputs}
                submit={submit}
                saving={sectionIsSaving}
                serverError={serverError}
                clientError={clientError}
                updateSection={updateSection}
                extraInfo={extraInfo}
            />
        );
    }
    return (
        <SettingItem
            active={active}
            areAllSectionsInactive={activeSection === ''}
            title={formatMessage(holders.username)}
            describe={user.username}
            section={'username'}
            updateSection={updateSection}
            max={max}
        />
    );
};

export default UsernameSection;
