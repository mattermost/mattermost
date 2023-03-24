// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import ReactSelect, {ValueType} from 'react-select';

import SettingItemMax from 'components/setting_item_max';

import {ActionResult} from 'mattermost-redux/types/actions';

import {UserProfile} from '@mattermost/types/users';

type Actions = {
    updateMe: (user: UserProfile) => Promise<ActionResult>;
};

type Props = {
    user: UserProfile;
    updateSection: (section: string) => void;
    firstDayOfWeek: number;
    actions: Actions;
    daysOfWeek: string[];
};
type SelectedOption = {
    value: string;
    label: string;
};

type State = {
    firstDayOfWeek: number;
    isSaving: boolean;
    serverError?: string;
    openMenu: boolean;
    selectedOption: SelectedOption;
};

export default class ManageFirstDayOfWeek extends React.PureComponent<
Props,
State
> {
    constructor(props: Props) {
        super(props);
        this.state = {
            firstDayOfWeek: props.firstDayOfWeek,
            isSaving: false,
            openMenu: false,
            selectedOption: {
                label: props.daysOfWeek[props.firstDayOfWeek],
                value: props.firstDayOfWeek.toString(),
            },
        };
    }

    onChange = (selectedOption: ValueType<SelectedOption>) => {
        if (selectedOption && 'value' in selectedOption) {
            this.setState({
                firstDayOfWeek: Number(selectedOption.value),
                selectedOption,
            });
        }
    };

    firstDayOfWeekNotChanged = () => {
        const {firstDayOfWeek} = this.state;
        const {firstDayOfWeek: oldFirstDayOfWeek} = this.props;
        return firstDayOfWeek === oldFirstDayOfWeek;
    };

    changeFirstDayOfWeek = () => {
        if (this.firstDayOfWeekNotChanged()) {
            this.props.updateSection('');
            return;
        }

        this.submitUser();
    };

    submitUser = () => {
        const {user, actions} = this.props;
        const {firstDayOfWeek} = this.state;

        const updatedUser = {
            ...user,
            props: {
                ...user.props,
                first_day_of_week: String(firstDayOfWeek),
            },
        };

        actions.updateMe(updatedUser).then((res) => {
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

    handleFirstDayOfWeek = (e: React.ChangeEvent<HTMLSelectElement>) => {
        this.setState({firstDayOfWeek: Number(e.target.value)});
    };
    render() {
        const daysOfWeekOptions = this.props.daysOfWeek.map((val, ind) => {
            return {
                value: ind.toString(),
                label: val,
            };
        });
        let serverError;
        if (this.state.serverError) {
            serverError = (
                <label className='has-error'>{this.state.serverError}</label>
            );
        }

        const inputs = [];
        const reactStyles = {
            menuPortal: (provided: React.CSSProperties) => ({
                ...provided,
                zIndex: 9999,
            }),
        };

        const firstDayOfWeekInput = (
            <div className='pt-2'>
                <ReactSelect
                    className='react-select react-select-top'
                    classNamePrefix='react-select'
                    id='displayFirstDayOfWeek'
                    menuPortalTarget={document.body}
                    styles={reactStyles}
                    options={daysOfWeekOptions}
                    clearable={false}
                    onChange={this.onChange}
                    value={this.state.selectedOption}
                    aria-labelledby='changeFirstDayOfWeek'
                    isDisabled={false}
                />
                {serverError}
            </div>
        );

        inputs.push(firstDayOfWeekInput);

        inputs.push(
            <div>
                <br/>
                <FormattedMessage
                    id='user.settings.firstDayOfWeek'
                    defaultMessage='Select the first day of week you want to see in the calendar.'
                />
            </div>,
        );

        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.display.firstDayOfWeek'
                        defaultMessage='First Day of Week'
                    />
                }
                containerStyle='timezone-container'
                width='medium'
                submit={this.changeFirstDayOfWeek}
                saving={this.state.isSaving}
                inputs={inputs}
                updateSection={this.props.updateSection}
            />
        );
    }
}
