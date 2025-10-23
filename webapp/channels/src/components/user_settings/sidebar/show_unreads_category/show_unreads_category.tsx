// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RefObject} from 'react';
import {FormattedMessage} from 'react-intl';

import {RadioInput} from '@mattermost/design-system';
import type {PreferencesType, PreferenceType} from '@mattermost/types/preferences';

import {Preferences} from 'mattermost-redux/constants';
import type {ActionResult} from 'mattermost-redux/types/actions';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {a11yFocus} from 'utils/utils';

export type OwnProps = {
    adminMode?: boolean;
    userId: string;
    userPreferences?: PreferencesType;
}

type Props = OwnProps & {
    active: boolean;
    areAllSectionsInactive: boolean;
    savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<ActionResult>;
    showUnreadsCategory: boolean;
    updateSection: (section: string) => void;
}

type State = {
    active: boolean;
    checked: boolean;
    isSaving: boolean;
}

export default class ShowUnreadsCategory extends React.PureComponent<Props, State> {
    minRef: RefObject<SettingItemMinComponent>;

    constructor(props: Props) {
        super(props);

        this.state = {
            active: false,
            checked: false,
            isSaving: false,
        };

        this.minRef = React.createRef();
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        if (props.active !== state.active) {
            if (props.active && !state.active) {
                return {
                    checked: props.showUnreadsCategory,
                    active: props.active,
                };
            }

            return {
                active: props.active,
            };
        }

        return null;
    }

    focusEditButton(): void {
        this.minRef.current?.focus();
    }

    handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({
            checked: e.target.value === 'true',
        });
        a11yFocus(e.target);
    };

    handleSubmit = async () => {
        if (!this.props.userId) {
            // Only for type safety, won't actually happen
            return;
        }

        this.setState({isSaving: true});

        await this.props.savePreferences(this.props.userId, [{
            user_id: this.props.userId,
            category: Preferences.CATEGORY_SIDEBAR_SETTINGS,
            name: Preferences.SHOW_UNREAD_SECTION,
            value: this.state.checked.toString(),
        }]);

        this.setState({isSaving: false});

        this.props.updateSection('');
    };

    renderDescription = () => {
        if (this.props.showUnreadsCategory) {
            return (
                <FormattedMessage
                    id='user.settings.sidebar.on'
                    defaultMessage='On'
                />
            );
        }

        return (
            <FormattedMessage
                id='user.settings.sidebar.off'
                defaultMessage='Off'
            />
        );
    };

    componentDidUpdate(prevProps: Props) {
        if (prevProps.active && !this.props.active && this.props.areAllSectionsInactive) {
            this.focusEditButton();
        }
    }

    render() {
        const title = (
            <FormattedMessage
                id='user.settings.sidebar.showUnreadsCategoryTitle'
                defaultMessage='Group unread channels separately'
            />
        );

        if (!this.props.active) {
            return (
                <SettingItemMin
                    title={title}
                    describe={this.renderDescription()}
                    section='showUnreadsCategory'
                    updateSection={this.props.updateSection}
                    ref={this.minRef}
                />
            );
        }

        return (
            <SettingItemMax
                title={title}
                inputs={
                    <fieldset>
                        <legend className='form-legend hidden-label'>
                            {title}
                        </legend>
                        <RadioInput
                            id='showUnreadsCategoryOn'
                            className='radio'
                            dataTestId='showUnreadsCategoryOn'
                            name='showUnreadsCategory'
                            checked={this.state.checked}
                            handleChange={() => this.setState({checked: true})}
                            title={
                                <FormattedMessage
                                    id='user.settings.sidebar.on'
                                    defaultMessage='On'
                                />
                            }
                        />
                        <RadioInput
                            id='showUnreadsCategoryOff'
                            className='radio'
                            dataTestId='showUnreadsCategoryOff'
                            name='showUnreadsCategory'
                            checked={!this.state.checked}
                            handleChange={() => this.setState({checked: false})}
                            title={
                                <FormattedMessage
                                    id='user.settings.sidebar.off'
                                    defaultMessage='Off'
                                />
                            }
                        />

                        <div className='mt-5'>
                            <FormattedMessage
                                id='user.settings.sidebar.showUnreadsCategoryDesc'
                                defaultMessage='When enabled, all unread channels and direct messages will be grouped together in the sidebar.'
                            />
                        </div>
                    </fieldset>
                }
                submit={this.handleSubmit}
                saving={this.state.isSaving}
                updateSection={this.props.updateSection}
            />
        );
    }
}
