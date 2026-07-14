// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode, RefObject} from 'react';
import {FormattedMessage} from 'react-intl';

import type {PreferenceType} from '@mattermost/types/preferences';

import {Preferences} from 'mattermost-redux/constants';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {AdvancedSections} from 'utils/constants';
import {a11yFocus} from 'utils/utils';

import type {OwnProps} from './index';

type Props = OwnProps & {
    active: boolean;
    areAllSectionsInactive: boolean;
    autoStatusUpdate: string;
    onUpdateSection: (section?: string) => void;
    renderOnOffLabel: (label: string) => ReactNode;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
    };
}

type State = {
    autoStatusUpdateState: string;
    isSaving?: boolean;
    serverError?: string;
}

export default class AutoStatusUpdateSection extends React.PureComponent<Props, State> {
    minRef: RefObject<SettingItemMinComponent>;

    constructor(props: Props) {
        super(props);

        this.state = {
            autoStatusUpdateState: props.autoStatusUpdate,
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

    handleOnChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const value = e.currentTarget.value;

        this.setState({autoStatusUpdateState: value});
        a11yFocus(e.currentTarget);
    };

    handleUpdateSection = (section?: string): void => {
        if (!section) {
            this.setState({autoStatusUpdateState: this.props.autoStatusUpdate});
        }

        this.props.onUpdateSection(section);
    };

    handleSubmit = (): void => {
        const {actions, userId, onUpdateSection} = this.props;
        const autoStatusUpdatePreference = {
            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
            user_id: userId,
            name: Preferences.ADVANCED_AUTO_STATUS_UPDATE,
            value: this.state.autoStatusUpdateState,
        };
        actions.savePreferences(userId, [autoStatusUpdatePreference]);

        onUpdateSection();
    };

    render(): React.ReactNode {
        const {autoStatusUpdateState} = this.state;
        const title = (
            <FormattedMessage
                id='user.settings.advance.autoStatusUpdateTitle'
                defaultMessage='Automatic status updates'
            />
        );

        if (this.props.active) {
            return (
                <SettingItemMax
                    title={title}
                    inputs={[
                        <fieldset key='autoStatusUpdateSetting'>
                            <legend className='form-legend hidden-label'>
                                {title}
                            </legend>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='autoStatusUpdateOn'
                                        type='radio'
                                        value={'true'}
                                        name={AdvancedSections.AUTO_STATUS_UPDATE}
                                        checked={autoStatusUpdateState !== 'false'}
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
                                        id='autoStatusUpdateOff'
                                        type='radio'
                                        value={'false'}
                                        name={AdvancedSections.AUTO_STATUS_UPDATE}
                                        checked={autoStatusUpdateState === 'false'}
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
                                    id='user.settings.advance.autoStatusUpdateDesc'
                                    defaultMessage='When "On", your status is automatically set to "Away" when you are inactive and back to "Online" when you return. When "Off", Mattermost will not change your status automatically, so it stays as you set it.'
                                />
                            </div>
                        </fieldset>,
                    ]}
                    setting={AdvancedSections.AUTO_STATUS_UPDATE}
                    submit={this.handleSubmit}
                    saving={this.state.isSaving}
                    serverError={this.state.serverError}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        return (
            <SettingItemMin
                title={title}
                describe={this.props.renderOnOffLabel(autoStatusUpdateState)}
                section={AdvancedSections.AUTO_STATUS_UPDATE}
                updateSection={this.handleUpdateSection}
                ref={this.minRef}
            />
        );
    }
}
