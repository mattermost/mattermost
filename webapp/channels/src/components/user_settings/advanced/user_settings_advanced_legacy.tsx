// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React, {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import Constants, {Preferences} from 'utils/constants';
import SettingItemMax from 'components/setting_item_max.jsx';
import SettingItemMin from 'components/setting_item_min';
import ConfirmModal from 'components/confirm_modal';

import {ActionResult} from 'mattermost-redux/types/actions';

import {UserProfile} from '@mattermost/types/users';
import {PreferenceType} from '@mattermost/types/preferences';
const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;

type Settings = {
    [key: string]: string | undefined;
    send_on_ctrl_enter: Props['sendOnCtrlEnter'];
    code_block_ctrl_enter: Props['codeBlockOnCtrlEnter'];
    formatting: Props['formatting'];
    join_leave: Props['joinLeave'];
};

export type Props = {
    currentUser: UserProfile;
    advancedSettingsCategory: PreferenceType[];
    sendOnCtrlEnter: string;
    codeBlockOnCtrlEnter: string;
    formatting: string;
    joinLeave: string;
    unreadScrollPosition: string;
    updateSection: (section?: string) => void;
    activeSection: string;
    closeModal: () => void;
    collapseModal: () => void;
    enablePreviewFeatures: boolean;
    enableUserDeactivation: boolean;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<ActionResult>;
        updateUserActive: (userId: string, active: boolean) => Promise<ActionResult>;
        revokeAllSessionsForUser: (userId: string) => Promise<ActionResult>;
    };
};

type State = {
    preReleaseFeatures: typeof PreReleaseFeatures;
    settings: Settings;
    enabledFeatures: number;
    isSaving: boolean;
    previewFeaturesEnabled: boolean;
    showDeactivateAccountModal: boolean;
    serverError: string;
    preReleaseFeaturesKeys: string[];
}

export default class AdvancedSettingsDisplay extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = this.getStateFromProps();
    }

    getStateFromProps = (): State => {
        const advancedSettings = this.props.advancedSettingsCategory;
        const settings: Settings = {
            send_on_ctrl_enter: this.props.sendOnCtrlEnter,
            code_block_ctrl_enter: this.props.codeBlockOnCtrlEnter,
            formatting: this.props.formatting,
            join_leave: this.props.joinLeave,
            [Preferences.UNREAD_SCROLL_POSITION]: this.props.unreadScrollPosition,
        };

        const PreReleaseFeaturesLocal = JSON.parse(JSON.stringify(PreReleaseFeatures));
        delete PreReleaseFeaturesLocal.MARKDOWN_PREVIEW;
        const preReleaseFeaturesKeys = Object.keys(PreReleaseFeaturesLocal);

        let enabledFeatures = 0;
        for (const as of advancedSettings) {
            for (const key of preReleaseFeaturesKeys) {
                const feature = PreReleaseFeaturesLocal[key];

                if (as.name === Constants.FeatureTogglePrefix + feature.label) {
                    settings[as.name] = as.value;

                    if (as.value === 'true') {
                        enabledFeatures += 1;
                    }
                }
            }
        }

        const isSaving = false;

        const previewFeaturesEnabled = this.props.enablePreviewFeatures;
        const showDeactivateAccountModal = false;

        return {
            preReleaseFeatures: PreReleaseFeaturesLocal,
            settings,
            preReleaseFeaturesKeys,
            enabledFeatures,
            isSaving,
            previewFeaturesEnabled,
            showDeactivateAccountModal,
            serverError: '',
        };
    }

    updateSetting = (setting: string, value: string): void => {
        const settings = this.state.settings;
        settings[setting] = value;

        this.setState((prevState) => ({...prevState, ...settings}));
    }

    handleSubmit = async (settings: string[]): Promise<void> => {
        const preferences: PreferenceType[] = [];
        const {actions, currentUser} = this.props;
        const userId = currentUser.id;

        // this should be refactored so we can actually be certain about what type everything is
        (Array.isArray(settings) ? settings : [settings]).forEach((setting) => {
            preferences.push({
                user_id: userId,
                category: Constants.Preferences.CATEGORY_ADVANCED_SETTINGS,
                name: setting,
                value: this.state.settings[setting],
            });
        });

        this.setState({isSaving: true});
        await actions.savePreferences(userId, preferences);

        this.handleUpdateSection('');
    }

    handleDeactivateAccountSubmit = async (): Promise<void> => {
        const userId = this.props.currentUser.id;

        this.setState({isSaving: true});

        this.props.actions.updateUserActive(userId, false).
            then(({error}) => {
                if (error) {
                    this.setState({serverError: error.message});
                }
            });

        const {data, error} = await this.props.actions.revokeAllSessionsForUser(userId);
        if (data) {
            emitUserLoggedOutEvent();
        } else if (error) {
            this.setState({serverError: error.message});
        }
    }

    handleShowDeactivateAccountModal = (): void => {
        this.setState({
            showDeactivateAccountModal: true,
        });
    }

    handleHideDeactivateAccountModal = (): void => {
        this.setState({
            showDeactivateAccountModal: false,
        });
    }

    handleUpdateSection = (section?: string): void => {
        if (!section) {
            this.setState(this.getStateFromProps());
        }
        this.setState({isSaving: false});
        this.props.updateSection(section);
    }

    render() {
        let deactivateAccountSection: ReactNode = '';
        let makeConfirmationModal: ReactNode = '';
        const currentUser = this.props.currentUser;

        if (currentUser.auth_service === '' && this.props.enableUserDeactivation) {
            if (this.props.activeSection === 'deactivateAccount') {
                deactivateAccountSection = (
                    <SettingItemMax
                        title={
                            <FormattedMessage
                                id='user.settings.advance.deactivateAccountTitle'
                                defaultMessage='Deactivate Account'
                            />
                        }
                        inputs={[
                            <div key='formattingSetting'>
                                <div>
                                    <br/>
                                    <FormattedMessage
                                        id='user.settings.advance.deactivateDesc'
                                        defaultMessage='Deactivating your account removes your ability to log in to this server and disables all email and mobile notifications. To reactivate your account, contact your System Administrator.'
                                    />
                                </div>
                            </div>,
                        ]}
                        saveButtonText={'Deactivate'}
                        setting={'deactivateAccount'}
                        submit={this.handleShowDeactivateAccountModal}
                        saving={this.state.isSaving}
                        server_error={this.state.serverError}
                        updateSection={this.handleUpdateSection}
                    />
                );
            } else {
                deactivateAccountSection = (
                    <SettingItemMin
                        title={
                            <FormattedMessage
                                id='user.settings.advance.deactivateAccountTitle'
                                defaultMessage='Deactivate Account'
                            />
                        }
                        describe={
                            <FormattedMessage
                                id='user.settings.advance.deactivateDescShort'
                                defaultMessage="Click 'Edit' to deactivate your account"
                            />
                        }
                        section={'deactivateAccount'}
                        updateSection={this.handleUpdateSection}
                    />
                );
            }

            const confirmButtonClass = 'btn btn-danger';
            const deactivateMemberButton = (
                <FormattedMessage
                    id='user.settings.advance.deactivate_member_modal.deactivateButton'
                    defaultMessage='Yes, deactivate my account'
                />
            );

            makeConfirmationModal = (
                <ConfirmModal
                    show={this.state.showDeactivateAccountModal}
                    title={
                        <FormattedMessage
                            id='user.settings.advance.confirmDeactivateAccountTitle'
                            defaultMessage='Confirm Deactivation'
                        />
                    }
                    message={
                        <FormattedMessage
                            id='user.settings.advance.confirmDeactivateDesc'
                            defaultMessage='Are you sure you want to deactivate your account? This can only be reversed by your System Administrator.'
                        />
                    }
                    confirmButtonClass={confirmButtonClass}
                    confirmButtonText={deactivateMemberButton}
                    onConfirm={this.handleDeactivateAccountSubmit}
                    onCancel={this.handleHideDeactivateAccountModal}
                />
            );
        }

        return (
            <div>
                <div className='user-settings'>
                    {deactivateAccountSection}
                    <div className='divider-dark'/>
                    {makeConfirmationModal}
                </div>
            </div>
        );
    }
}
/* eslint-enable react/no-string-refs */
