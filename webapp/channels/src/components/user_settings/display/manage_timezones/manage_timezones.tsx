// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import ReactSelect from 'react-select';
import type {ValueType} from 'react-select';
import type {Timezone} from 'timezones.json';

import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {getTimezoneLabel} from 'mattermost-redux/utils/timezone_utils';

import SettingItemMax from 'components/setting_item_max';

import {getBrowserTimezone} from 'utils/timezone';

type Actions = {
    updateMe: (user: UserProfile) => Promise<ActionResult>;
    patchUser: (user: UserProfile) => Promise<ActionResult>;
}

type Props = {
    user: UserProfile;
    updateSection: (section: string) => void;
    useAutomaticTimezone: boolean;
    automaticTimezone: string;
    manualTimezone: string;
    timezones: Timezone[];
    timezoneLabel: string;
    actions: Actions;
    adminMode?: boolean;
}
type SelectedOption = {
    value: string;
    label: string;
}

type State = {
    useAutomaticTimezone: boolean;
    automaticTimezone: string;
    manualTimezone: string;
    isSaving: boolean;
    serverError?: string;
    openMenu: boolean;
    selectedOption: SelectedOption;
}

export default class ManageTimezones extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            useAutomaticTimezone: props.useAutomaticTimezone,
            automaticTimezone: props.automaticTimezone,
            manualTimezone: props.manualTimezone,
            isSaving: false,
            openMenu: false,
            selectedOption: {label: props.timezoneLabel, value: props.useAutomaticTimezone ? props.automaticTimezone : props.manualTimezone},
        };
    }

    onChange = (selectedOption: ValueType<SelectedOption>) => {
        if (selectedOption && 'value' in selectedOption) {
            this.setState({
                manualTimezone: selectedOption.value,
                selectedOption,
            });
        }
    };

    timezoneNotChanged = () => {
        const {
            useAutomaticTimezone,
            automaticTimezone,
            manualTimezone,
        } = this.state;

        const {
            useAutomaticTimezone: oldUseAutomaticTimezone,
            automaticTimezone: oldAutomaticTimezone,
            manualTimezone: oldManualTimezone,
        } = this.props;

        return (
            useAutomaticTimezone === oldUseAutomaticTimezone &&
            automaticTimezone === oldAutomaticTimezone &&
            manualTimezone === oldManualTimezone
        );
    };

    changeTimezone = () => {
        if (this.timezoneNotChanged()) {
            this.props.updateSection('');
            return;
        }

        this.submitUser();
    };

    submitUser = () => {
        const {user} = this.props;
        const {useAutomaticTimezone, automaticTimezone, manualTimezone} = this.state;

        const timezone = {
            useAutomaticTimezone: useAutomaticTimezone.toString(),
            automaticTimezone,
            manualTimezone,
        };

        const updatedUser = {
            ...user,
            timezone,
        };

        const action = this.props.adminMode ? this.props.actions.patchUser : this.props.actions.updateMe;
        action(updatedUser).
            then((res) => {
                if ('data' in res) {
                    this.props.updateSection('');
                } else if ('error' in res) {
                    const {error} = res;
                    let serverError;
                    if (error instanceof Error) {
                        serverError = error.message;
                    } else {
                        serverError = error as string;
                    }
                    this.setState({serverError, isSaving: false});
                }
            });
    };

    handleAutomaticTimezone = (e: React.ChangeEvent<HTMLInputElement>) => {
        const useAutomaticTimezone = e.target.checked;
        let automaticTimezone = '';
        let timezoneLabel: string;
        let selectedOptionValue: string;

        if (useAutomaticTimezone) {
            automaticTimezone = getBrowserTimezone();
            timezoneLabel = getTimezoneLabel(this.props.timezones, automaticTimezone);
            selectedOptionValue = automaticTimezone;
        } else {
            timezoneLabel = getTimezoneLabel(this.props.timezones, getBrowserTimezone());
            selectedOptionValue = getBrowserTimezone();
            this.setState({
                manualTimezone: getBrowserTimezone(),
            });
        }

        this.setState({
            useAutomaticTimezone,
            automaticTimezone,
            selectedOption: {label: timezoneLabel, value: selectedOptionValue},
        });
    };

    render() {
        const {timezones} = this.props;
        const {useAutomaticTimezone} = this.state;

        let index = 0;
        let previousTimezone: Timezone;

        const timeOptions = this.props.timezones.map((timeObject) => {
            if (timeObject.utc[index] === previousTimezone?.utc[index]) {
                index++;
            } else {
                // It's safe to use the first item since consecutive timezones
                // don't have the same 'utc' array.
                index = index === 0 ? index : 0;
            }

            previousTimezone = timeObject;

            // Some more context on why different 'utc' items are used can be found here.
            // https://github.com/mattermost/mattermost/pull/29290#issuecomment-2478492626
            return {
                value: timeObject.utc[index],
                label: timeObject.text,
            };
        });

        let serverError;
        if (this.state.serverError) {
            serverError = <label className='has-error'>{this.state.serverError}</label>;
        }

        const inputs = [];

        // These are passed to the 'key' prop and should all be unique.
        const inputId = {
            automaticTimezoneInput: 1,
            manualTimezoneInput: 2,
            message: 3,
        };

        const reactStyles = {

            menuPortal: (provided: React.CSSProperties) => ({
                ...provided,
                zIndex: 9999,
            }),

        };

        const noTimezonesFromServer = timezones.length === 0;
        const automaticTimezoneInput = (
            <div
                className='checkbox'
                key={inputId.automaticTimezoneInput}
            >
                <label>
                    <input
                        id='automaticTimezoneInput'
                        type='checkbox'
                        checked={useAutomaticTimezone}
                        onChange={this.handleAutomaticTimezone}
                        disabled={noTimezonesFromServer}
                    />
                    <FormattedMessage
                        id='user.settings.timezones.automatic'
                        defaultMessage='Automatic'
                    />

                </label>
            </div>
        );

        const manualTimezoneInput = (
            <div
                className='pt-2'
                key={inputId.manualTimezoneInput}
            >
                <ReactSelect
                    className='react-select react-select-top'
                    classNamePrefix='react-select'
                    id='displayTimezone'
                    menuPortalTarget={document.body}
                    styles={reactStyles}
                    options={timeOptions}
                    clearable={false}
                    onChange={this.onChange}
                    value={this.state.selectedOption}
                    aria-labelledby='changeInterfaceTimezoneLabel'
                    isDisabled={useAutomaticTimezone}
                />
                {serverError}
            </div>
        );

        inputs.push(automaticTimezoneInput);

        inputs.push(manualTimezoneInput);

        inputs.push(
            <div key={inputId.message}>
                <br/>
                <FormattedMessage
                    id='user.settings.timezones.promote'
                    defaultMessage='Select the time zone used for timestamps in the user interface and email notifications.'
                />
            </div>,
        );

        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.display.timezone'
                        defaultMessage='Timezone'
                    />
                }
                containerStyle='timezone-container'
                submit={this.changeTimezone}
                saving={this.state.isSaving}
                inputs={inputs}
                updateSection={this.props.updateSection}
            />
        );
    }
}

