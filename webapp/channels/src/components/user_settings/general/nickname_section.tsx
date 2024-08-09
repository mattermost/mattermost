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

import type {GlobalState} from 'types/store';

import {holders} from './messages';

type Props = {
    activeSection: string;
    user: UserProfile;
    nickname: string;
    setNickname: (value: string) => void;
    updateSection: (section: string) => void;
    submitUser: (user: UserProfile, emailUpdated: boolean) => void;
    serverError: string;
    clientError: string;
    sectionIsSaving: boolean;
}
const NicknameSection = ({
    activeSection,
    user,
    nickname,
    setNickname,
    updateSection,
    clientError,
    sectionIsSaving,
    serverError,
    submitUser,
}: Props) => {
    const {formatMessage} = useIntl();
    const samlNicknameAttributeSet = useSelector((state: GlobalState) => getConfig(state).SamlNicknameAttributeSet === 'true');
    const ldapNicknameAttributeSet = useSelector((state: GlobalState) => getConfig(state).LdapNicknameAttributeSet === 'true');
    const isMobileView = useSelector((state: GlobalState) => getIsMobileView(state));

    const updateNickname = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setNickname(e.target.value);
    }, []);

    const submitNickname = useCallback(() => {
        const patchedUser = Object.assign({}, user);
        const patchedNickname = nickname.trim();

        if (patchedUser.nickname === patchedNickname) {
            updateSection('');
            return;
        }

        patchedUser.nickname = patchedNickname;

        trackEvent('settings', 'user_settings_update', {field: 'nickname'});

        submitUser(patchedUser, false);
    }, []);

    const active = activeSection === 'nickname';
    let max = null;
    if (active) {
        const inputs = [];

        let extraInfo;
        let submit = null;
        if ((user.auth_service === 'ldap' && ldapNicknameAttributeSet) || (user.auth_service === Constants.SAML_SERVICE && samlNicknameAttributeSet)) {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.field_handled_externally'
                        defaultMessage='This field is handled through your login provider. If you want to change it, you need to do so through your login provider.'
                    />
                </span>
            );
        } else {
            let nicknameLabel: JSX.Element|string = (
                <FormattedMessage
                    id='user.settings.general.nickname'
                    defaultMessage='Nickname'
                />
            );
            if (isMobileView) {
                nicknameLabel = '';
            }

            inputs.push(
                <div
                    key='nicknameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{nicknameLabel}</label>
                    <div className='col-sm-7'>
                        <input
                            id='nickname'
                            autoFocus={true}
                            className='form-control'
                            type='text'
                            onChange={updateNickname}
                            value={nickname}
                            maxLength={Constants.MAX_NICKNAME_LENGTH}
                            autoCapitalize='off'
                            aria-label={formatMessage({id: 'user.settings.general.nickname', defaultMessage: 'Nickname'})}
                        />
                    </div>
                </div>,
            );

            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.nicknameExtra'
                        defaultMessage='Use Nickname for a name you might be called that is different from your first name and username. This is most often used when two or more people have similar sounding names and usernames.'
                    />
                </span>
            );

            submit = submitNickname;
        }

        max = (
            <SettingItemMax
                title={formatMessage(holders.nickname)}
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
    if (user.nickname) {
        describe = user.nickname;
    } else {
        describe = (
            <FormattedMessage
                id='user.settings.general.emptyNickname'
                defaultMessage="Click 'Edit' to add a nickname"
            />
        );
        if (isMobileView) {
            describe = (
                <FormattedMessage
                    id='user.settings.general.mobile.emptyNickname'
                    defaultMessage='Click to add a nickname'
                />
            );
        }
    }

    return (
        <SettingItem
            active={active}
            areAllSectionsInactive={activeSection === ''}
            title={formatMessage(holders.nickname)}
            describe={describe}
            section={'nickname'}
            updateSection={updateSection}
            max={max}
        />
    );
};

export default NicknameSection;
