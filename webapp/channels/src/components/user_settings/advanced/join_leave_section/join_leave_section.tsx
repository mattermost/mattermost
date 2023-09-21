// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode, RefObject} from 'react';
import {FormattedMessage} from 'react-intl';

import type {PreferenceType} from '@mattermost/types/preferences';

import {Preferences} from 'mattermost-redux/constants';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min/setting_item_min';

import {AdvancedSections} from 'utils/constants';
import {a11yFocus} from 'utils/utils';

type Props = {
    active: boolean;
    areAllSectionsInactive: boolean;
    currentUserId: string;
    joinLeave?: string;
    onUpdateSection: (section?: string) => void;
    renderOnOffLabel: (label: string) => ReactNode;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
    };
}

type State = {
    joinLeaveState?: string;
    isSaving?: boolean;
    serverError?: string;
}

export default class JoinLeaveSection extends React.PureComponent<Props, State> {
    minRef: RefObject<SettingItemMinComponent>;

    constructor(props: Props) {
        super(props);

        this.state = {
            joinLeaveState: props.joinLeave,
        };

        this.minRef = React.createRef();
    }

    focusEditButton(): void {
        this.minRef.current?.focus();
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.active && !this.props.active && this.props.areAllSectionsInactive) {
            this.focusEditButton();
        }
    }

    public handleOnChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const value = e.currentTarget.value;

        this.setState({joinLeaveState: value});
        a11yFocus(e.currentTarget);
    };

    public handleUpdateSection = (section?: string): void => {
        if (!section) {
            this.setState({joinLeaveState: this.props.joinLeave});
        }

        this.props.onUpdateSection(section);
    };

    public handleSubmit = (): void => {
        const {actions, currentUserId, onUpdateSection} = this.props;
        const joinLeavePreference = {category: Preferences.CATEGORY_ADVANCED_SETTINGS, user_id: currentUserId, name: Preferences.ADVANCED_FILTER_JOIN_LEAVE, value: this.state.joinLeaveState};
        actions.savePreferences(currentUserId, [joinLeavePreference]);

        onUpdateSection();
    };

    public render(): React.ReactNode {
        const {joinLeaveState} = this.state;
        if (this.props.active) {
            return (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.advance.joinLeaveTitle'
                            defaultMessage='Enable Join/Leave Messages'
                        />
                    }
                    inputs={[
                        <fieldset key='joinLeaveSetting'>
                            <legend className='form-legend hidden-label'>
                                <FormattedMessage
                                    id='user.settings.advance.joinLeaveTitle'
                                    defaultMessage='Enable Join/Leave Messages'
                                />
                            </legend>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='joinLeaveOn'
                                        type='radio'
                                        value={'true'}
                                        name={AdvancedSections.JOIN_LEAVE}
                                        checked={joinLeaveState === 'true'}
                                        onChange={this.handleOnChange}
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
                                        id='joinLeaveOff'
                                        type='radio'
                                        value={'false'}
                                        name={AdvancedSections.JOIN_LEAVE}
                                        checked={joinLeaveState === 'false'}
                                        onChange={this.handleOnChange}
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
                                    id='user.settings.advance.joinLeaveDesc'
                                    defaultMessage='When "On", System Messages saying a user has joined or left a channel will be visible. When "Off", the System Messages about joining or leaving a channel will be hidden. A message will still show up when you are added to a channel, so you can receive a notification.'
                                />
                            </div>
                        </fieldset>,
                    ]}
                    setting={AdvancedSections.JOIN_LEAVE}
                    submit={this.handleSubmit}
                    saving={this.state.isSaving}
                    serverError={this.state.serverError}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        return (
            <SettingItemMin
                title={
                    <FormattedMessage
                        id='user.settings.advance.joinLeaveTitle'
                        defaultMessage='Enable Join/Leave Messages'
                    />
                }
                describe={this.props.renderOnOffLabel(joinLeaveState!)}
                section={AdvancedSections.JOIN_LEAVE}
                updateSection={this.handleUpdateSection}
                ref={this.minRef}
            />
        );
    }
}
