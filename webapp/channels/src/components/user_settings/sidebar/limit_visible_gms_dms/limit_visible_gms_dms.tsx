// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PreferenceType} from '@mattermost/types/preferences';
import React, {RefObject} from 'react';
import {FormattedMessage} from 'react-intl';
import ReactSelect, {ValueType} from 'react-select';

import {Preferences} from 'mattermost-redux/constants';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import SettingItemMinComponent from 'components/setting_item_min/setting_item_min';

import {localizeMessage} from 'utils/utils';

type Limit = {
    value: number;
    label: string;
};

type Props = {
    active: boolean;
    areAllSectionsInactive: boolean;
    currentUserId: string;
    savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<{data: boolean}>;
    dmGmLimit: number;
    updateSection: (section: string) => void;
}

type State = {
    active: boolean;
    limit: Limit;
    isSaving: boolean;
}

const limits: Limit[] = [
    {value: 10000, label: localizeMessage('user.settings.sidebar.limitVisibleGMsDMs.allDirectMessages', 'All Direct Messages')},
    {value: 10, label: '10'},
    {value: 15, label: '15'},
    {value: 20, label: '20'},
    {value: 40, label: '40'},
];

export default class LimitVisibleGMsDMs extends React.PureComponent<Props, State> {
    minRef: RefObject<SettingItemMinComponent>;

    constructor(props: Props) {
        super(props);

        this.state = {
            active: false,
            limit: {value: 20, label: '20'},
            isSaving: false,
        };

        this.minRef = React.createRef();
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        if (props.active !== state.active) {
            if (props.active && !state.active) {
                return {
                    limit: limits.find((l) => l.value === props.dmGmLimit),
                    active: props.active,
                };
            }

            return {
                active: props.active,
            };
        } else if (!props.active) {
            return {
                limit: limits.find((l) => l.value === props.dmGmLimit),
            };
        }

        return null;
    }

    focusEditButton(): void {
        this.minRef.current?.focus();
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.active && !this.props.active && this.props.areAllSectionsInactive) {
            this.focusEditButton();
        }
    }

    handleChange = (selected: ValueType<Limit>) => {
        if (selected && 'value' in selected) {
            this.setState({limit: selected});
        }
    };

    handleSubmit = async () => {
        this.setState({isSaving: true});

        await this.props.savePreferences(this.props.currentUserId, [{
            user_id: this.props.currentUserId,
            category: Preferences.CATEGORY_SIDEBAR_SETTINGS,
            name: Preferences.LIMIT_VISIBLE_DMS_GMS,
            value: this.state.limit.value.toString(),
        }]);

        this.setState({isSaving: false});

        this.props.updateSection('');
    };

    renderDescription = () => {
        return (
            <span>{this.state.limit.label}</span>
        );
    };

    render() {
        const title = (
            <FormattedMessage
                id='user.settings.sidebar.limitVisibleGMsDMsTitle'
                defaultMessage='Number of direct messages to show'
            />
        );

        if (!this.props.active) {
            return (
                <SettingItemMin
                    title={title}
                    describe={this.renderDescription()}
                    section='limitVisibleGMsDMs'
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
                        <ReactSelect
                            className='react-select'
                            classNamePrefix='react-select'
                            id='limitVisibleGMsDMs'
                            options={limits}
                            clearable={false}
                            onChange={this.handleChange}
                            value={this.state.limit}
                            isSearchable={false}
                            menuPortalTarget={document.body}
                            styles={reactStyles}
                        />
                        <div className='mt-5'>
                            <FormattedMessage
                                id='user.settings.sidebar.limitVisibleGMsDMsDesc'
                                defaultMessage='You can also change these settings in the direct messages sidebar menu.'
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

const reactStyles = {
    menuPortal: (provided: React.CSSProperties) => ({
        ...provided,
        zIndex: 9999,
    }),
};
