// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {PreferencesType, PreferenceType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import ConfirmModal from 'components/confirm_modal';
import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';

import Constants, {AdvancedSections, Preferences} from 'utils/constants';
import {isMac} from 'utils/user_agent';
import {a11yFocus} from 'utils/utils';

import JoinLeaveSection from './join_leave_section';
import PerformanceDebuggingSection from './performance_debugging_section';

import SettingDesktopHeader from '../headers/setting_desktop_header';
import SettingMobileHeader from '../headers/setting_mobile_header';

import type {PropsFromRedux} from './index';

type Settings = {
    [key: string]: string | undefined;
    send_on_ctrl_enter: Props['sendOnCtrlEnter'];
    code_block_ctrl_enter: Props['codeBlockOnCtrlEnter'];
    formatting: Props['formatting'];
    join_leave: Props['joinLeave'];
    sync_drafts: Props['syncDrafts'];
};

export type OwnProps = {
    adminMode?: boolean;
    user: UserProfile;
    userPreferences?: PreferencesType;
    updateSection: (section?: string) => void;
    activeSection: string;
    closeModal: () => void;
    collapseModal: () => void;
}

export type Props = OwnProps & PropsFromRedux;

type State = {
    settings: Settings;
    isSaving: boolean;
    showDeactivateAccountModal: boolean;
    serverError: string;
}

export default class AdvancedSettingsDisplay extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = this.getStateFromProps();
    }

    getStateFromProps = (): State => {
        const settings: Settings = {
            send_on_ctrl_enter: this.props.sendOnCtrlEnter,
            code_block_ctrl_enter: this.props.codeBlockOnCtrlEnter,
            formatting: this.props.formatting,
            join_leave: this.props.joinLeave,
            sync_drafts: this.props.syncDrafts,
            [Preferences.UNREAD_SCROLL_POSITION]: this.props.unreadScrollPosition,
        };

        const isSaving = false;

        const showDeactivateAccountModal = false;

        return {
            settings,
            isSaving,
            showDeactivateAccountModal,
            serverError: '',
        };
    };

    updateSetting = (setting: string, value: string, e?: React.ChangeEvent): void => {
        const settings = this.state.settings;
        settings[setting] = value;

        this.setState((prevState) => ({...prevState, ...settings}));
        a11yFocus(e?.currentTarget as HTMLElement);
    };

    handleSubmit = async (settings: string[]): Promise<void> => {
        if (!this.props.user) {
            return;
        }

        const preferences: PreferenceType[] = [];
        const {actions, user} = this.props;
        const userId = user.id;

        // this should be refactored so we can actually be certain about what type everything is
        (Array.isArray(settings) ? settings : [settings]).forEach((setting) => {
            preferences.push({
                user_id: userId,
                category: Constants.Preferences.CATEGORY_ADVANCED_SETTINGS,
                name: setting,
                value: this.state.settings[setting]!,
            });
        });

        this.setState({isSaving: true});
        await actions.savePreferences(userId, preferences);

        this.handleUpdateSection('');
    };

    handleDeactivateAccountSubmit = async (): Promise<void> => {
        const userId = this.props.user.id;

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
    };

    handleShowDeactivateAccountModal = (): void => {
        this.setState({
            showDeactivateAccountModal: true,
        });
    };

    handleHideDeactivateAccountModal = (): void => {
        this.setState({
            showDeactivateAccountModal: false,
        });
    };

    handleUpdateSection = (section?: string): void => {
        if (!section) {
            this.setState(this.getStateFromProps());
        }
        this.setState({isSaving: false});
        this.props.updateSection(section);
    };

    // This function changes ctrl to cmd when OS is mac
    getCtrlSendText = () => {
        const description = defineMessages({
            default: {
                id: 'user.settings.advance.sendDesc',
                defaultMessage: 'When enabled, CTRL + ENTER will send the message and ENTER inserts a new line.',
            },
            mac: {
                id: 'user.settings.advance.sendDesc.mac',
                defaultMessage: 'When enabled, ⌘ + ENTER will send the message and ENTER inserts a new line.',
            },
        });
        const title = defineMessages({
            default: {
                id: 'user.settings.advance.sendTitle',
                defaultMessage: 'Send Messages on CTRL+ENTER',
            },
            mac: {
                id: 'user.settings.advance.sendTitle.mac',
                defaultMessage: 'Send Messages on ⌘+ENTER',
            },
        });
        if (isMac()) {
            return {
                ctrlSendTitle: title.mac,
                ctrlSendDesc: description.mac,
            };
        }
        return {
            ctrlSendTitle: title.default,
            ctrlSendDesc: description.default,
        };
    };

    renderOnOffLabel(enabled: string): JSX.Element {
        if (enabled === 'false') {
            return (
                <FormattedMessage
                    id='user.settings.advance.off'
                    defaultMessage='Off'
                />
            );
        }

        return (
            <FormattedMessage
                id='user.settings.advance.on'
                defaultMessage='On'
            />
        );
    }

    renderUnreadScrollPositionLabel(option?: string): JSX.Element {
        if (option === Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT) {
            return (
                <FormattedMessage
                    id='user.settings.advance.startFromLeftOff'
                    defaultMessage='Start me where I left off'
                />
            );
        }

        return (
            <FormattedMessage
                id='user.settings.advance.startFromNewest'
                defaultMessage='Start me at the newest message'
            />
        );
    }

    renderCtrlEnterLabel(): JSX.Element {
        const ctrlEnter = this.state.settings.send_on_ctrl_enter;
        const codeBlockCtrlEnter = this.state.settings.code_block_ctrl_enter;
        if (ctrlEnter === 'false' && codeBlockCtrlEnter === 'false') {
            return (
                <FormattedMessage
                    id='user.settings.advance.off'
                    defaultMessage='Off'
                />
            );
        } else if (ctrlEnter === 'true' && codeBlockCtrlEnter === 'true') {
            return (
                <FormattedMessage
                    id='user.settings.advance.onForAllMessages'
                    defaultMessage='On for all messages'
                />
            );
        }
        return (
            <FormattedMessage
                id='user.settings.advance.onForCode'
                defaultMessage='On only for code blocks starting with ```'
            />
        );
    }

    renderFormattingSection = () => {
        const active = this.props.activeSection === 'formatting';
        let max = null;
        if (active) {
            max = (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.advance.formattingTitle'
                            defaultMessage='Enable Post Formatting'
                        />
                    }
                    inputs={[
                        <fieldset key='formattingSetting'>
                            <legend className='form-legend hidden-label'>
                                <FormattedMessage
                                    id='user.settings.advance.formattingTitle'
                                    defaultMessage='Enable Post Formatting'
                                />
                            </legend>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='postFormattingOn'
                                        type='radio'
                                        name='formatting'
                                        checked={this.state.settings.formatting !== 'false'}
                                        onChange={this.updateSetting.bind(this, 'formatting', 'true')}
                                    />
                                    <FormattedMessage
                                        id='user.settings.advance.on'
                                        defaultMessage='On'
                                    />
                                </label>
                                <br/>
                            </div>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='postFormattingOff'
                                        type='radio'
                                        name='formatting'
                                        checked={this.state.settings.formatting === 'false'}
                                        onChange={this.updateSetting.bind(this, 'formatting', 'false')}
                                    />
                                    <FormattedMessage
                                        id='user.settings.advance.off'
                                        defaultMessage='Off'
                                    />
                                </label>
                                <br/>
                            </div>
                            <div className='mt-5'>
                                <FormattedMessage
                                    id='user.settings.advance.formattingDesc'
                                    defaultMessage='If enabled, posts will be formatted to create links, show emoji, style the text, and add line breaks. By default, this setting is enabled.'
                                />
                            </div>
                        </fieldset>,
                    ]}
                    submit={this.handleSubmit.bind(this, ['formatting'])}
                    saving={this.state.isSaving}
                    serverError={this.state.serverError}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        return (
            <SettingItem
                active={active}
                areAllSectionsInactive={this.props.activeSection === ''}
                title={
                    <FormattedMessage
                        id='user.settings.advance.formattingTitle'
                        defaultMessage='Enable Post Formatting'
                    />
                }
                describe={this.renderOnOffLabel(this.state.settings.formatting)}
                section={'formatting'}
                updateSection={this.handleUpdateSection}
                max={max}
            />
        );
    };

    renderUnreadScrollPositionSection = () => {
        const active = this.props.activeSection === Preferences.UNREAD_SCROLL_POSITION;
        let max = null;
        if (active) {
            max = (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.advance.unreadScrollPositionTitle'
                            defaultMessage='Scroll position when viewing an unread channel'
                        />
                    }
                    inputs={[
                        <fieldset key='unreadScrollPositionSetting'>
                            <legend className='form-legend hidden-label'>
                                <FormattedMessage
                                    id='user.settings.advance.unreadScrollPositionTitle'
                                    defaultMessage='Scroll position when viewing an unread channel'
                                />
                            </legend>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='unreadPositionStartFromLeftOff'
                                        type='radio'
                                        name='unreadScrollPosition'
                                        checked={this.state.settings.unread_scroll_position === Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT}
                                        onChange={this.updateSetting.bind(this, Preferences.UNREAD_SCROLL_POSITION, Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT)}
                                    />
                                    <FormattedMessage
                                        id='user.settings.advance.startFromLeftOff'
                                        defaultMessage='Start me where I left off'
                                    />
                                </label>
                                <br/>
                            </div>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='unreadPositionStartFromNewest'
                                        type='radio'
                                        name='unreadScrollPosition'
                                        checked={this.state.settings.unread_scroll_position === Preferences.UNREAD_SCROLL_POSITION_START_FROM_NEWEST}
                                        onChange={this.updateSetting.bind(this, Preferences.UNREAD_SCROLL_POSITION, Preferences.UNREAD_SCROLL_POSITION_START_FROM_NEWEST)}
                                    />
                                    <FormattedMessage
                                        id='user.settings.advance.startFromNewest'
                                        defaultMessage='Start me at the newest message'
                                    />
                                </label>
                                <br/>
                            </div>
                            <div className='mt-5'>
                                <FormattedMessage
                                    id='user.settings.advance.unreadScrollPositionDesc'
                                    defaultMessage='Choose your scroll position when you view an unread channel. Channels will always be marked as read when viewed.'
                                />
                            </div>
                        </fieldset>,
                    ]}
                    submit={this.handleSubmit.bind(this, [Preferences.UNREAD_SCROLL_POSITION])}
                    saving={this.state.isSaving}
                    serverError={this.state.serverError}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        return (
            <SettingItem
                active={active}
                areAllSectionsInactive={this.props.activeSection === ''}
                title={
                    <FormattedMessage
                        id='user.settings.advance.unreadScrollPositionTitle'
                        defaultMessage='Scroll position when viewing an unread channel'
                    />
                }
                describe={this.renderUnreadScrollPositionLabel(this.state.settings[Preferences.UNREAD_SCROLL_POSITION])}
                section={Preferences.UNREAD_SCROLL_POSITION}
                updateSection={this.handleUpdateSection}
                max={max}
            />
        );
    };

    renderSyncDraftsSection = () => {
        const active = this.props.activeSection === AdvancedSections.SYNC_DRAFTS;
        let max = null;
        if (active) {
            max = (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.advance.syncDrafts.Title'
                            defaultMessage='Allow message drafts to sync with the server'
                        />
                    }
                    inputs={[
                        <fieldset key='syncDraftsSetting'>
                            <legend className='form-legend hidden-label'>
                                <FormattedMessage
                                    id='user.settings.advance.syncDrafts.Title'
                                    defaultMessage='Allow message drafts to sync with the server'
                                />
                            </legend>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='syncDraftsOn'
                                        type='radio'
                                        name='syncDrafts'
                                        checked={this.state.settings.sync_drafts !== 'false'}
                                        onChange={this.updateSetting.bind(this, 'sync_drafts', 'true')}
                                    />
                                    <FormattedMessage
                                        id='user.settings.advance.on'
                                        defaultMessage='On'
                                    />
                                </label>
                                <br/>
                            </div>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='syncDraftsOff'
                                        type='radio'
                                        name='syncDrafts'
                                        checked={this.state.settings.sync_drafts === 'false'}
                                        onChange={this.updateSetting.bind(this, 'sync_drafts', 'false')}
                                    />
                                    <FormattedMessage
                                        id='user.settings.advance.off'
                                        defaultMessage='Off'
                                    />
                                </label>
                                <br/>
                            </div>
                            <div className='mt-5'>
                                <FormattedMessage
                                    id='user.settings.advance.syncDrafts.Desc'
                                    defaultMessage='When enabled, message drafts are synced with the server so they can be accessed from any device. When disabled, message drafts are only saved locally on the device where they are composed.'
                                />
                            </div>
                        </fieldset>,
                    ]}
                    setting={AdvancedSections.SYNC_DRAFTS}
                    submit={this.handleSubmit.bind(this, ['sync_drafts'])}
                    saving={this.state.isSaving}
                    serverError={this.state.serverError}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        return (
            <SettingItem
                active={active}
                areAllSectionsInactive={this.props.activeSection === ''}
                title={
                    <FormattedMessage
                        id='user.settings.advance.syncDrafts.Title'
                        defaultMessage='Allow message drafts to sync with the server'
                    />
                }
                describe={this.renderOnOffLabel(this.state.settings.sync_drafts)}
                section={AdvancedSections.SYNC_DRAFTS}
                updateSection={this.handleUpdateSection}
                max={max}
            />
        );
    };

    renderCtrlSendSection = () => {
        const active = this.props.activeSection === 'advancedCtrlSend';
        const serverError = this.state.serverError || null;
        const {ctrlSendTitle, ctrlSendDesc} = this.getCtrlSendText();
        let max = null;
        if (active) {
            const ctrlSendActive = [
                this.state.settings.send_on_ctrl_enter === 'true',
                this.state.settings.send_on_ctrl_enter === 'false' && this.state.settings.code_block_ctrl_enter === 'true',
                this.state.settings.send_on_ctrl_enter === 'false' && this.state.settings.code_block_ctrl_enter === 'false',
            ];

            const inputs = [
                <fieldset key='ctrlSendSetting'>
                    <legend className='form-legend hidden-label'>
                        <FormattedMessage {...ctrlSendTitle}/>
                    </legend>
                    <div className='radio'>
                        <label>
                            <input
                                id='ctrlSendOn'
                                type='radio'
                                name='sendOnCtrlEnter'
                                checked={ctrlSendActive[0]}
                                onChange={(e) => {
                                    this.updateSetting('send_on_ctrl_enter', 'true');
                                    this.updateSetting('code_block_ctrl_enter', 'true');
                                    a11yFocus(e.currentTarget);
                                }}
                            />
                            <FormattedMessage
                                id='user.settings.advance.onForAllMessages'
                                defaultMessage='On for all messages'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='ctrlSendOnForCode'
                                type='radio'
                                name='sendOnCtrlEnter'
                                checked={ctrlSendActive[1]}
                                onChange={(e) => {
                                    this.updateSetting('send_on_ctrl_enter', 'false');
                                    this.updateSetting('code_block_ctrl_enter', 'true');
                                    a11yFocus(e.currentTarget);
                                }}
                            />
                            <FormattedMessage
                                id='user.settings.advance.onForCode'
                                defaultMessage='On only for code blocks starting with ```'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='ctrlSendOff'
                                type='radio'
                                name='sendOnCtrlEnter'
                                checked={ctrlSendActive[2]}
                                onChange={(e) => {
                                    this.updateSetting('send_on_ctrl_enter', 'false');
                                    this.updateSetting('code_block_ctrl_enter', 'false');
                                    a11yFocus(e.currentTarget);
                                }}
                            />
                            <FormattedMessage
                                id='user.settings.advance.off'
                                defaultMessage='Off'
                            />
                        </label>
                        <br/>
                    </div>
                    <div>
                        <br/>
                        <FormattedMessage {...ctrlSendDesc}/>
                    </div>
                </fieldset>,
            ];
            max = (
                <SettingItemMax
                    title={
                        <FormattedMessage {...ctrlSendTitle}/>
                    }
                    inputs={inputs}
                    submit={this.handleSubmit.bind(this, ['send_on_ctrl_enter', 'code_block_ctrl_enter'])}
                    saving={this.state.isSaving}
                    serverError={serverError}
                    updateSection={this.handleUpdateSection}
                />
            );
        }
        return (
            <SettingItem
                active={active}
                areAllSectionsInactive={this.props.activeSection === ''}
                title={
                    <FormattedMessage {...ctrlSendTitle}/>
                }
                describe={this.renderCtrlEnterLabel()}
                section={'advancedCtrlSend'}
                updateSection={this.handleUpdateSection}
                max={max}
            />
        );
    };

    render() {
        const ctrlSendSection = this.renderCtrlSendSection();

        const formattingSection = this.renderFormattingSection();
        let formattingSectionDivider = null;
        if (formattingSection) {
            formattingSectionDivider = <div className='divider-light'/>;
        }

        let deactivateAccountSection: ReactNode = '';
        let makeConfirmationModal: ReactNode = '';

        if (this.props.user.auth_service === '' && this.props.enableUserDeactivation && !this.props.adminMode) {
            const active = this.props.activeSection === 'deactivateAccount';
            let max = null;
            if (active) {
                max = (
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
                        saveButtonClassName={'btn-danger'}
                        setting={'deactivateAccount'}
                        submit={this.handleShowDeactivateAccountModal}
                        saving={this.state.isSaving}
                        serverError={this.state.serverError}
                        updateSection={this.handleUpdateSection}
                    />
                );
            }
            deactivateAccountSection = (
                <SettingItem
                    active={active}
                    areAllSectionsInactive={this.props.activeSection === ''}
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
                    max={max}
                />
            );

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

        const unreadScrollPositionSection = this.renderUnreadScrollPositionSection();
        let unreadScrollPositionSectionDivider = null;
        if (unreadScrollPositionSection) {
            unreadScrollPositionSectionDivider = <div className='divider-light'/>;
        }

        let syncDraftsSection = null;
        let syncDraftsSectionDivider = null;
        if (this.props.syncedDraftsAreAllowed) {
            syncDraftsSection = this.renderSyncDraftsSection();
            if (syncDraftsSection) {
                syncDraftsSectionDivider = <div className='divider-light'/>;
            }
        }

        return (
            <div
                id='advancedSettings'
                aria-labelledby='advancedButton'
                role='tabpanel'
            >
                <SettingMobileHeader
                    closeModal={this.props.closeModal}
                    collapseModal={this.props.collapseModal}
                    text={
                        <FormattedMessage
                            id='user.settings.advance.title'
                            defaultMessage='Advanced Settings'
                        />
                    }
                />
                <div className='user-settings'>
                    <SettingDesktopHeader
                        text={
                            <FormattedMessage
                                id='user.settings.advance.title'
                                defaultMessage='Advanced Settings'
                            />
                        }
                    />
                    <div className='divider-dark first'/>
                    {ctrlSendSection}
                    {formattingSectionDivider}
                    {formattingSection}
                    <div className='divider-light'/>
                    <JoinLeaveSection
                        active={this.props.activeSection === AdvancedSections.JOIN_LEAVE}
                        areAllSectionsInactive={this.props.activeSection === ''}
                        onUpdateSection={this.handleUpdateSection}
                        renderOnOffLabel={this.renderOnOffLabel}
                        adminMode={this.props.adminMode}
                        userPreferences={this.props.userPreferences}
                        userId={this.props.user.id}
                    />
                    <PerformanceDebuggingSection
                        active={this.props.activeSection === AdvancedSections.PERFORMANCE_DEBUGGING}
                        onUpdateSection={this.handleUpdateSection}
                        areAllSectionsInactive={this.props.activeSection === ''}
                        adminMode={this.props.adminMode}
                        userId={this.props.user.id}
                    />
                    {unreadScrollPositionSectionDivider}
                    {unreadScrollPositionSection}
                    {syncDraftsSectionDivider}
                    {syncDraftsSection}
                    {formattingSectionDivider}
                    {deactivateAccountSection}
                    <div className='divider-dark'/>
                    {makeConfirmationModal}
                </div>
            </div>
        );
    }
}
