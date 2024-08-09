// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import {getIsMobileView} from 'selectors/views/browser';

import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';

import {Constants} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import {holders} from './messages';

type Props = {
    activeSection: string;
    user: UserProfile;
    firstName: string;
    setFirstName: (value: string) => void;
    lastName: string;
    setLastName: (value: string) => void;
    updateSection: (section: string) => void;
    submitUser: (user: UserProfile, emailUpdated: boolean) => void;
    serverError: string;
    clientError: string;
    sectionIsSaving: boolean;
    updateTab: (tab: string) => void;
};
const NameSection = ({
    activeSection,
    user,
    firstName,
    lastName,
    setFirstName,
    setLastName,
    updateSection,
    clientError,
    sectionIsSaving,
    serverError,
    submitUser,
    updateTab,
}: Props) => {
    const {formatMessage} = useIntl();
    const samlFirstNameAttributeSet = useSelector((state: GlobalState) => getConfig(state).SamlFirstNameAttributeSet === 'true');
    const ldapFirstNameAttributeSet = useSelector((state: GlobalState) => getConfig(state).LdapFirstNameAttributeSet === 'true');
    const samlLastNameAttributeSet = useSelector((state: GlobalState) => getConfig(state).SamlLastNameAttributeSet === 'true');
    const ldapLastNameAttributeSet = useSelector((state: GlobalState) => getConfig(state).LdapLastNameAttributeSet === 'true');
    const isMobileView = useSelector((state: GlobalState) => getIsMobileView(state));

    const updateFirstName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFirstName(e.target.value);
    }, [setFirstName]);

    const updateLastName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLastName(e.target.value);
    }, [setLastName]);

    const submitName = useCallback(() => {
        const patchedUser = Object.assign({}, user);
        const patchedFirstName = firstName.trim();
        const patchedLastName = lastName.trim();

        if (patchedUser.first_name === patchedFirstName && patchedUser.last_name === patchedLastName) {
            updateSection('');
            return;
        }

        patchedUser.first_name = patchedFirstName;
        patchedUser.last_name = patchedLastName;

        trackEvent('settings', 'user_settings_update', {field: 'fullname'});

        submitUser(patchedUser, false);
    }, [firstName, lastName, submitUser, updateSection, user]);

    const active = activeSection === 'name';
    let max = null;
    if (active) {
        const inputs = [];

        let extraInfo;
        let submit = null;
        if (
            (user.auth_service === Constants.LDAP_SERVICE &&
                (ldapFirstNameAttributeSet || ldapLastNameAttributeSet)) ||
            (user.auth_service === Constants.SAML_SERVICE &&
                (samlFirstNameAttributeSet || samlLastNameAttributeSet)) ||
            (Constants.OAUTH_SERVICES.includes(user.auth_service))
        ) {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.field_handled_externally'
                        defaultMessage='This field is handled through your login provider. If you want to change it, you need to do so through your login provider.'
                    />
                </span>
            );
        } else {
            inputs.push(
                <div
                    key='firstNameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>
                        <FormattedMessage
                            id='user.settings.general.firstName'
                            defaultMessage='First Name'
                        />
                    </label>
                    <div className='col-sm-7'>
                        <input
                            id='firstName'
                            autoFocus={true}
                            className='form-control'
                            type='text'
                            onChange={updateFirstName}
                            maxLength={Constants.MAX_FIRSTNAME_LENGTH}
                            value={firstName}
                            onFocus={Utils.moveCursorToEnd}
                            aria-label={formatMessage({id: 'user.settings.general.firstName', defaultMessage: 'First Name'})}
                        />
                    </div>
                </div>,
            );

            inputs.push(
                <div
                    key='lastNameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>
                        <FormattedMessage
                            id='user.settings.general.lastName'
                            defaultMessage='Last Name'
                        />
                    </label>
                    <div className='col-sm-7'>
                        <input
                            id='lastName'
                            className='form-control'
                            type='text'
                            onChange={updateLastName}
                            maxLength={Constants.MAX_LASTNAME_LENGTH}
                            value={lastName}
                            aria-label={formatMessage({id: 'user.settings.general.lastName', defaultMessage: 'Last Name'})}
                        />
                    </div>
                </div>,
            );

            const notifClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                updateSection('');
                updateTab('notifications');
            };

            const notifLink = (
                <a
                    href='#'
                    onClick={notifClick.bind(this)}
                >
                    <FormattedMessage
                        id='user.settings.general.notificationsLink'
                        defaultMessage='Notifications'
                    />
                </a>
            );

            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.notificationsExtra'
                        defaultMessage='By default, you will receive mention notifications when someone types your first name. Go to {notify} settings to change this default.'
                        values={{
                            notify: (notifLink),
                        }}
                    />
                </span>
            );

            submit = submitName;
        }

        max = (
            <SettingItemMax
                title={formatMessage(holders.fullName)}
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

    let describe: JSX.Element|string = '';

    if (user.first_name && user.last_name) {
        describe = user.first_name + ' ' + user.last_name;
    } else if (user.first_name) {
        describe = user.first_name;
    } else if (user.last_name) {
        describe = user.last_name;
    } else {
        describe = (
            <FormattedMessage
                id='user.settings.general.emptyName'
                defaultMessage="Click 'Edit' to add your full name"
            />
        );
        if (isMobileView) {
            describe = (
                <FormattedMessage
                    id='user.settings.general.mobile.emptyName'
                    defaultMessage='Click to add your full name'
                />
            );
        }
    }

    return (
        <SettingItem
            active={active}
            areAllSectionsInactive={activeSection === ''}
            title={formatMessage(holders.fullName)}
            describe={describe}
            section={'name'}
            updateSection={updateSection}
            max={max}
        />
    );
};

export default NameSection;
