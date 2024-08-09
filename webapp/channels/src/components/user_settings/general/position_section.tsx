// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React, {PureComponent, useCallback} from 'react';
import {FormattedMessage, injectIntl, useIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {AnnouncementBarMessages, AnnouncementBarTypes, Constants, ValidationErrors} from 'utils/constants';
import * as Utils from 'utils/utils';

import {holders} from './messages';

import SettingDesktopHeader from '../headers/setting_desktop_header';
import SettingMobileHeader from '../headers/setting_mobile_header';
import { useSelector } from 'react-redux';

import { getConfig } from 'mattermost-redux/selectors/entities/general';
import { getIsMobileView } from 'selectors/views/browser';
import { GlobalState } from 'types/store';

type Props = {
    user: UserProfile;
    activeSection: string;
    setPosition: (value: string) => void;
    position: string;
    updateSection: (section: string) => void;
    submitUser: (user: UserProfile, emailUpdated: boolean) => void;
    serverError: React.ReactNode;
    clientError: React.ReactNode;
    sectionIsSaving: boolean;
};
const PositionSection = ({
    user,
    activeSection,
    setPosition,
    position,
    updateSection,
    submitUser,
    clientError,
    serverError,
    sectionIsSaving,
}: Props) => {
    const {formatMessage} = useIntl();

    const samlPositionAttributeSet = useSelector((state: GlobalState) => getConfig(state).SamlPositionAttributeSet === 'true');
    const ldapPositionAttributeSet = useSelector((state: GlobalState) => getConfig(state).LdapPositionAttributeSet === 'true');
    const isMobileView = useSelector((state: GlobalState) => getIsMobileView(state));

    const submitPosition = useCallback(() => {
        const patchedUser = Object.assign({}, user);
        const patchedPosition = position.trim();

        if (patchedUser.position === patchedPosition) {
            updateSection('');
            return;
        }

        patchedUser.position = patchedPosition;

        trackEvent('settings', 'user_settings_update', {field: 'position'});

        submitUser(patchedUser, false);
    }, []);

    const updatePosition = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setPosition(e.target.value);
    }, []);

    const active = activeSection === 'position';
    let max = null;
    if (active) {
        const inputs = [];

        let extraInfo: JSX.Element|string;
        let submit = null;
        if ((user.auth_service === Constants.LDAP_SERVICE && ldapPositionAttributeSet) || (user.auth_service === Constants.SAML_SERVICE && samlPositionAttributeSet)) {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.field_handled_externally'
                        defaultMessage='This field is handled through your login provider. If you want to change it, you need to do so through your login provider.'
                    />
                </span>
            );
        } else {
            let positionLabel: JSX.Element | string = (
                <FormattedMessage
                    id='user.settings.general.position'
                    defaultMessage='Position'
                />
            );
            if (isMobileView) {
                positionLabel = '';
            }

            inputs.push(
                <div
                    key='positionSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{positionLabel}</label>
                    <div className='col-sm-7'>
                        <input
                            id='position'
                            autoFocus={true}
                            className='form-control'
                            type='text'
                            onChange={updatePosition}
                            value={position}
                            maxLength={Constants.MAX_POSITION_LENGTH}
                            autoCapitalize='off'
                            onFocus={Utils.moveCursorToEnd}
                            aria-label={formatMessage({id: 'user.settings.general.position', defaultMessage: 'Position'})}
                        />
                    </div>
                </div>,
            );

            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.general.positionExtra'
                        defaultMessage='Use Position for your role or job title. This will be shown in your profile popover.'
                    />
                </span>
            );

            submit = submitPosition;
        }

        max = (
            <SettingItemMax
                title={formatMessage(holders.position)}
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
    if (user.position) {
        describe = user.position;
    } else {
        describe = (
            <FormattedMessage
                id='user.settings.general.emptyPosition'
                defaultMessage="Click 'Edit' to add your job title / position"
            />
        );
        if (isMobileView) {
            describe = (
                <FormattedMessage
                    id='user.settings.general.mobile.emptyPosition'
                    defaultMessage='Click to add your job title / position'
                />
            );
        }
    }

    return (
        <SettingItem
            active={active}
            areAllSectionsInactive={activeSection === ''}
            title={formatMessage(holders.position)}
            describe={describe}
            section={'position'}
            updateSection={updateSection}
            max={max}
        />
    );
};

export default PositionSection;
