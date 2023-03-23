// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {AdminConfig} from '@mattermost/types/config';
import {DeepPartial} from '@mattermost/types/utilities';

import * as Utils from 'utils/utils';
import Card from 'components/card/card';
import BlockableLink from 'components/admin_console/blockable_link';
import {getHistory} from 'utils/browser_history';
import DropdownInputHybrid from 'components/widgets/inputs/dropdown_input_hybrid';
import {keepForeverOption, yearsOption, daysOption, FOREVER, YEARS, DAYS} from 'components/admin_console/data_retention_settings/dropdown_options/dropdown_options';

import './global_policy_form.scss';
import SaveButton from 'components/save_button';
import {ServerError} from '@mattermost/types/errors';

type ValueType = {
    label: string | JSX.Element;
    value: string;
}
type Props = {
    config: DeepPartial<AdminConfig>;
    actions: {
        updateConfig: (config: Record<string, any>) => Promise<{ data?: AdminConfig; error?: ServerError }>;
        setNavigationBlocked: (blocked: boolean) => void;
    };
};
type State = {
    messageRetentionDropdownValue: ValueType;
    messageRetentionInputValue: string;
    fileRetentionDropdownValue: ValueType;
    fileRetentionInputValue: string;
    boardsRetentionDropdownValue: ValueType;
    boardsRetentionInputValue: string;
    saveNeeded: boolean;
    saving: boolean;
    serverError: JSX.Element | string | null;
    formErrorText: string;
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
            messageRetentionDropdownValue: this.getDefaultDropdownValue(DataRetentionSettings?.EnableMessageDeletion, DataRetentionSettings?.MessageRetentionDays),
            messageRetentionInputValue: this.getDefaultInputValue(DataRetentionSettings?.EnableMessageDeletion, DataRetentionSettings?.MessageRetentionDays),
            fileRetentionDropdownValue: this.getDefaultDropdownValue(DataRetentionSettings?.EnableFileDeletion, DataRetentionSettings?.FileRetentionDays),
            fileRetentionInputValue: this.getDefaultInputValue(DataRetentionSettings?.EnableFileDeletion, DataRetentionSettings?.FileRetentionDays),
            boardsRetentionDropdownValue: this.getDefaultDropdownValue(DataRetentionSettings?.EnableBoardsDeletion, DataRetentionSettings?.BoardsRetentionDays),
            boardsRetentionInputValue: this.getDefaultInputValue(DataRetentionSettings?.EnableBoardsDeletion, DataRetentionSettings?.BoardsRetentionDays),
        };
    }

    includeBoards = this.props.config.PluginSettings?.PluginStates?.focalboard?.Enable && this.props.config.FeatureFlags?.BoardsDataRetention

    getDefaultInputValue = (isEnabled: boolean | undefined, days: number | undefined): string => {
        if (!isEnabled || days === undefined) {
            return '';
        }
        if (days % 365 === 0) {
            return (days / 365).toString();
        }
        return days.toString();
    }
    getDefaultDropdownValue = (isEnabled: boolean | undefined, days: number | undefined) => {
        if (!isEnabled || days === undefined) {
            return keepForeverOption();
        }
        if (days % 365 === 0) {
            return yearsOption();
        }
        return daysOption();
    }

    handleSubmit = async () => {
        const {messageRetentionDropdownValue, messageRetentionInputValue, fileRetentionDropdownValue, fileRetentionInputValue, boardsRetentionDropdownValue, boardsRetentionInputValue} = this.state;
        const newConfig: AdminConfig = JSON.parse(JSON.stringify(this.props.config));

        this.setState({saving: true});

        if ((messageRetentionDropdownValue.value !== FOREVER && parseInt(messageRetentionInputValue, 10) < 1) || (fileRetentionDropdownValue.value !== FOREVER && parseInt(fileRetentionInputValue, 10) < 1)) {
            this.setState({formErrorText: Utils.localizeMessage('admin.data_retention.global_policy.form.numberError', 'You must add a number greater than or equal to 1.'), saving: false});
            return;
        }

        newConfig.DataRetentionSettings.EnableMessageDeletion = this.setDeletionEnabled(messageRetentionDropdownValue.value);

        const messageDays = this.setRetentionDays(messageRetentionDropdownValue.value, messageRetentionInputValue);
        if (messageDays >= 1) {
            newConfig.DataRetentionSettings.MessageRetentionDays = messageDays;
        }

        newConfig.DataRetentionSettings.EnableFileDeletion = this.setDeletionEnabled(fileRetentionDropdownValue.value);

        const fileDays = this.setRetentionDays(fileRetentionDropdownValue.value, fileRetentionInputValue);
        if (fileDays >= 1) {
            newConfig.DataRetentionSettings.FileRetentionDays = fileDays;
        }

        newConfig.DataRetentionSettings.EnableBoardsDeletion = this.setDeletionEnabled(boardsRetentionDropdownValue.value);

        const boardsDays = this.setRetentionDays(boardsRetentionDropdownValue.value, boardsRetentionInputValue);
        if (boardsDays >= 1) {
            newConfig.DataRetentionSettings.BoardsRetentionDays = boardsDays;
        }

        const {error} = await this.props.actions.updateConfig(newConfig);

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
    }

    setRetentionDays = (dropdownValue: string, value: string): number => {
        if (dropdownValue === YEARS) {
            return parseInt(value, 10) * 365;
        }

        if (dropdownValue === DAYS) {
            return parseInt(value, 10);
        }

        return 0;
    }

    render = () => {
        return (
            <div className='wrapper--fixed DataRetentionSettings'>
                <div className='admin-console__header with-back'>
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
                </div>
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
                                    <p>{Utils.localizeMessage('admin.data_retention.form.text', 'Applies to all teams and channels, but does not apply to custom retention policies.')}</p>
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
                                            defaultValue={keepForeverOption()}
                                            options={[daysOption(), yearsOption(), keepForeverOption()]}
                                            legend={Utils.localizeMessage('admin.data_retention.form.channelAndDirectMessageRetention', 'Channel & direct message retention')}
                                            placeholder={Utils.localizeMessage('admin.data_retention.form.channelAndDirectMessageRetention', 'Channel & direct message retention')}
                                            name={'channel_message_retention'}
                                            inputType={'number'}
                                            dropdownClassNamePrefix={'channel_message_retention_dropdown'}
                                            inputId={'channel_message_retention_input'}
                                        />
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
                                            defaultValue={keepForeverOption()}
                                            options={[daysOption(), yearsOption(), keepForeverOption()]}
                                            legend={Utils.localizeMessage('admin.data_retention.form.fileRetention', 'File retention')}
                                            placeholder={Utils.localizeMessage('admin.data_retention.form.fileRetention', 'File retention')}
                                            name={'file_retention'}
                                            inputType={'number'}
                                            dropdownClassNamePrefix={'file_retention_dropdown'}
                                            inputId={'file_retention_input'}
                                        />
                                    </div>
                                    { this.includeBoards &&
                                    <div id='global_boards_dropdown'>
                                        <DropdownInputHybrid
                                            onDropdownChange={(value) => {
                                                if (this.state.boardsRetentionDropdownValue.value !== value.value) {
                                                    this.setState({boardsRetentionDropdownValue: value, saveNeeded: true});
                                                    this.props.actions.setNavigationBlocked(true);
                                                }
                                            }}
                                            onInputChange={(e) => {
                                                this.setState({boardsRetentionInputValue: e.target.value, saveNeeded: true});
                                                this.props.actions.setNavigationBlocked(true);
                                            }}
                                            value={this.state.boardsRetentionDropdownValue}
                                            inputValue={this.state.boardsRetentionInputValue}
                                            width={90}
                                            exceptionToInput={[FOREVER]}
                                            defaultValue={keepForeverOption()}
                                            options={[daysOption(), yearsOption(), keepForeverOption()]}
                                            legend={Utils.localizeMessage('admin.data_retention.form.boardsRetention', 'Boards retention')}
                                            placeholder={Utils.localizeMessage('admin.data_retention.form.boardsRetention', 'Boards retention')}
                                            name={'boards_retention'}
                                            inputType={'number'}
                                            dropdownClassNamePrefix={'boards_retention_dropdown'}
                                            inputId={'boards_retention_input'}
                                        />
                                    </div>}
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
    }
}
