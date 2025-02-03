// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';

import type {AdminConfig, EnvironmentConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BlockableLink from 'components/admin_console/blockable_link';
import {keepForeverOption, yearsOption, daysOption, FOREVER, YEARS, DAYS, hoursOption} from 'components/admin_console/data_retention_settings/dropdown_options/dropdown_options';
import SetByEnv from 'components/admin_console/set_by_env';
import Card from 'components/card/card';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import DropdownInputHybrid from 'components/widgets/inputs/dropdown_input_hybrid';

import {getHistory} from 'utils/browser_history';

import './global_policy_form.scss';

type ValueType = {
    label: string | JSX.Element;
    value: string;
}
type Props = {
    config: DeepPartial<AdminConfig>;
    messageRetentionHours: string | undefined;
    fileRetentionHours: string | undefined;
    environmentConfig: Partial<EnvironmentConfig>;
    actions: {
        patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
        setNavigationBlocked: (blocked: boolean) => void;
    };
};
type State = {
    messageRetentionDropdownValue: ValueType;
    messageRetentionInputValue: string;
    fileRetentionDropdownValue: ValueType;
    fileRetentionInputValue: string;
    saveNeeded: boolean;
    saving: boolean;
    serverError: React.ReactNode;
    formErrorText: React.ReactNode;
}

export default class GlobalPolicyForm extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        const {DataRetentionSettings} = props.config;
        this.state = {
            saveNeeded: false,
            saving: false,
            serverError: null,
            formErrorText: '',
            messageRetentionDropdownValue: this.getDefaultDropdownValue(DataRetentionSettings?.EnableMessageDeletion, props.messageRetentionHours),
            messageRetentionInputValue: this.getDefaultInputValue(DataRetentionSettings?.EnableMessageDeletion, props.messageRetentionHours),
            fileRetentionDropdownValue: this.getDefaultDropdownValue(DataRetentionSettings?.EnableFileDeletion, props.fileRetentionHours),
            fileRetentionInputValue: this.getDefaultInputValue(DataRetentionSettings?.EnableFileDeletion, props.fileRetentionHours),
        };
    }

    getDefaultInputValue = (isEnabled: boolean | undefined, hours: string | undefined): string => {
        if (!isEnabled || hours === undefined) {
            return '';
        }
        const hoursInt = parseInt(hours, 10);

        // 8760 hours in a year
        if (hoursInt % 8760 === 0) {
            return (hoursInt / 8760).toString();
        }
        if (hoursInt % 24 === 0) {
            return (hoursInt / 24).toString();
        }

        return hours.toString();
    };
    getDefaultDropdownValue = (isEnabled: boolean | undefined, hours: string | undefined) => {
        if (!isEnabled || hours === undefined) {
            return keepForeverOption();
        }
        const hoursInt = parseInt(hours, 10);

        // 8760 hours in a year
        if (hoursInt % 8760 === 0) {
            return yearsOption();
        }
        if (hoursInt % 24 === 0) {
            return daysOption();
        }

        return hoursOption();
    };

    handleSubmit = async () => {
        const {messageRetentionDropdownValue, messageRetentionInputValue, fileRetentionDropdownValue, fileRetentionInputValue} = this.state;
        const newConfig: AdminConfig = JSON.parse(JSON.stringify(this.props.config));

        this.setState({saving: true});

        if ((messageRetentionDropdownValue.value !== FOREVER && parseInt(messageRetentionInputValue, 10) < 1) || (fileRetentionDropdownValue.value !== FOREVER && parseInt(fileRetentionInputValue, 10) < 1)) {
            this.setState({
                formErrorText: (
                    <FormattedMessage
                        id='admin.data_retention.global_policy.form.numberError'
                        defaultMessage='You must add a number greater than or equal to 1.'
                    />
                ),
                saving: false,
            });
            return;
        }

        newConfig.DataRetentionSettings.EnableMessageDeletion = this.setDeletionEnabled(messageRetentionDropdownValue.value);

        if (!this.isMessageRetentionSetByEnv() && this.setDeletionEnabled(messageRetentionDropdownValue.value)) {
            newConfig.DataRetentionSettings.MessageRetentionDays = 0;
            newConfig.DataRetentionSettings.MessageRetentionHours = this.setRetentionHours(messageRetentionDropdownValue.value, messageRetentionInputValue);
        }

        newConfig.DataRetentionSettings.EnableFileDeletion = this.setDeletionEnabled(fileRetentionDropdownValue.value);

        if (!this.isFileRetentionSetByEnv() && this.setDeletionEnabled(fileRetentionDropdownValue.value)) {
            newConfig.DataRetentionSettings.FileRetentionDays = 0;
            newConfig.DataRetentionSettings.FileRetentionHours = this.setRetentionHours(fileRetentionDropdownValue.value, fileRetentionInputValue);
        }

        const {error} = await this.props.actions.patchConfig(newConfig);

        if (error) {
            this.setState({serverError: error.message, saving: false});
        } else {
            this.props.actions.setNavigationBlocked(false);
            getHistory().push('/admin_console/compliance/data_retention_settings');
        }
    };

    setDeletionEnabled = (dropdownValue: string) => {
        if (dropdownValue === FOREVER) {
            return false;
        }
        return true;
    };

    setRetentionHours = (dropdownValue: string, value: string): number => {
        if (dropdownValue === YEARS) {
            return parseInt(value, 10) * 24 * 365;
        }
        if (dropdownValue === DAYS) {
            return parseInt(value, 10) * 24;
        }
        return parseInt(value, 10);
    };

    isMessageRetentionSetByEnv = () => {
        return (this.props.environmentConfig?.DataRetentionSettings?.MessageRetentionDays && this.props.config.DataRetentionSettings?.MessageRetentionDays && this.props.config.DataRetentionSettings.MessageRetentionDays > 0) ||
        (this.props.environmentConfig?.DataRetentionSettings?.MessageRetentionHours && this.props.config.DataRetentionSettings?.MessageRetentionHours && this.props.config.DataRetentionSettings.MessageRetentionHours > 0) ||
        (this.props.environmentConfig?.DataRetentionSettings?.EnableMessageDeletion && !this.props.config.DataRetentionSettings?.EnableMessageDeletion);
    };

    isFileRetentionSetByEnv = () => {
        return (this.props.environmentConfig?.DataRetentionSettings?.FileRetentionDays && this.props.config.DataRetentionSettings?.FileRetentionDays && this.props.config.DataRetentionSettings.FileRetentionDays > 0) ||
        (this.props.environmentConfig?.DataRetentionSettings?.FileRetentionHours && this.props.config.DataRetentionSettings?.FileRetentionHours && this.props.config.DataRetentionSettings.FileRetentionHours > 0) ||
        (this.props.environmentConfig?.DataRetentionSettings?.EnableFileDeletion && !this.props.config.DataRetentionSettings?.EnableFileDeletion);
    };

    render = () => {
        return (
            <div className='wrapper--fixed DataRetentionSettings'>
                <AdminHeader withBackButton={true}>
                    <div>
                        <BlockableLink
                            to='/admin_console/compliance/data_retention_settings'
                            className='fa fa-angle-left back'
                        />
                        <FormattedMessage
                            id='admin.data_retention.globalPolicyTitle'
                            defaultMessage='Global Retention Policy'
                        />
                    </div>
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <Card
                            expanded={true}
                            className={'console'}
                        >
                            <Card.Body>
                                <div
                                    className='global_policy'
                                >
                                    <p>
                                        <FormattedMessage
                                            id='admin.data_retention.form.text'
                                            defaultMessage='Applies to all teams and channels, but does not apply to custom retention policies.'
                                        />
                                    </p>
                                    <div id='global_direct_message_dropdown'>
                                        <DropdownInputHybrid
                                            onDropdownChange={(value) => {
                                                if (this.state.messageRetentionDropdownValue.value !== value.value) {
                                                    this.setState({messageRetentionDropdownValue: value, saveNeeded: true});
                                                    this.props.actions.setNavigationBlocked(true);
                                                }
                                            }}
                                            onInputChange={(e) => {
                                                this.setState({messageRetentionInputValue: e.target.value, saveNeeded: true});
                                                this.props.actions.setNavigationBlocked(true);
                                            }}
                                            value={this.state.messageRetentionDropdownValue}
                                            inputValue={this.state.messageRetentionInputValue}
                                            width={90}
                                            exceptionToInput={[FOREVER]}
                                            disabled={this.isMessageRetentionSetByEnv()}
                                            defaultValue={keepForeverOption()}
                                            options={[hoursOption(), daysOption(), yearsOption(), keepForeverOption()]}
                                            legend={messages.channelAndMessageRetention}
                                            placeholder={messages.channelAndMessageRetention}
                                            name={'channel_message_retention'}
                                            inputType={'number'}
                                            dropdownClassNamePrefix={'channel_message_retention_dropdown'}
                                            inputId={'channel_message_retention_input'}
                                        />
                                        {this.isMessageRetentionSetByEnv() && <SetByEnv/>}
                                    </div>
                                    <div id='global_file_dropdown'>
                                        <DropdownInputHybrid
                                            onDropdownChange={(value) => {
                                                if (this.state.fileRetentionDropdownValue.value !== value.value) {
                                                    this.setState({fileRetentionDropdownValue: value, saveNeeded: true});
                                                    this.props.actions.setNavigationBlocked(true);
                                                }
                                            }}
                                            onInputChange={(e) => {
                                                this.setState({fileRetentionInputValue: e.target.value, saveNeeded: true});
                                                this.props.actions.setNavigationBlocked(true);
                                            }}
                                            value={this.state.fileRetentionDropdownValue}
                                            inputValue={this.state.fileRetentionInputValue}
                                            width={90}
                                            exceptionToInput={[FOREVER]}
                                            disabled={this.isFileRetentionSetByEnv()}
                                            defaultValue={keepForeverOption()}
                                            options={[hoursOption(), daysOption(), yearsOption(), keepForeverOption()]}
                                            legend={messages.fileRetention}
                                            placeholder={messages.fileRetention}
                                            name={'file_retention'}
                                            inputType={'number'}
                                            dropdownClassNamePrefix={'file_retention_dropdown'}
                                            inputId={'file_retention_input'}
                                        />
                                        {this.isFileRetentionSetByEnv() && <SetByEnv/>}
                                    </div>
                                </div>

                            </Card.Body>
                        </Card>
                    </div>
                </div>
                <div className='admin-console-save'>
                    <SaveButton
                        saving={this.state.saving}
                        disabled={!this.state.saveNeeded}
                        onClick={this.handleSubmit}
                        defaultMessage={(
                            <FormattedMessage
                                id='admin.data_retention.custom_policy.save'
                                defaultMessage='Save'
                            />
                        )}
                    />
                    <BlockableLink
                        className='cancel-button'
                        to='/admin_console/compliance/data_retention_settings'
                    >
                        <FormattedMessage
                            id='admin.data_retention.custom_policy.cancel'
                            defaultMessage='Cancel'
                        />
                    </BlockableLink>
                    {this.state.serverError &&
                        <span className='CustomPolicy__error'>
                            <i className='icon icon-alert-outline'/>
                            {this.state.serverError}
                        </span>
                    }
                    {
                        this.state.formErrorText &&
                        <span className='CustomPolicy__error'>
                            <i className='icon icon-alert-outline'/>
                            {this.state.formErrorText}
                        </span>
                    }
                </div>
            </div>
        );
    };
}

const messages = defineMessages({
    channelAndMessageRetention: {
        id: 'admin.data_retention.form.channelAndDirectMessageRetention',
        defaultMessage: 'Channel & direct message retention',
    },
    fileRetention: {
        id: 'admin.data_retention.form.fileRetention',
        defaultMessage: 'File retention',
    },
});
