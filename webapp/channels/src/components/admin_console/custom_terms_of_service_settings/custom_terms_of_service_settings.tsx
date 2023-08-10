// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import AdminSettings from 'components/admin_console/admin_settings';
import BooleanSetting from 'components/admin_console/boolean_setting';
import SettingsGroup from 'components/admin_console/settings_group';
import TextSetting from 'components/admin_console/text_setting';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import LoadingScreen from 'components/loading_screen';

import {Constants} from 'utils/constants';

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';
import type {TermsOfService} from '@mattermost/types/terms_of_service';
import type {BaseProps, BaseState} from 'components/admin_console/admin_settings';

type Props = BaseProps & {
    actions: {
        getTermsOfService: () => Promise<{data: TermsOfService}>;
        createTermsOfService: (text: string) => Promise<{data: TermsOfService; error?: Error}>;
    };
    config: AdminConfig;
    license: ClientLicense;
    setNavigationBlocked: () => void;

    /*
     * Action to save config file
     */
    updateConfig: () => void;
};

type State = BaseState & {
    termsEnabled?: boolean;
    reAcceptancePeriod?: number;
    loadingTermsText: boolean;
    receivedTermsText: string;
    termsText: string;
    saveNeeded: boolean;
    saving: boolean;
    serverError: JSX.Element | string | null;
    errorTooltip: boolean;
}

export default class CustomTermsOfServiceSettings extends AdminSettings<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            termsEnabled: props.config.SupportSettings?.CustomTermsOfServiceEnabled,
            reAcceptancePeriod: props.config.SupportSettings?.CustomTermsOfServiceReAcceptancePeriod,
            loadingTermsText: true,
            receivedTermsText: '',
            termsText: '',
            saveNeeded: false,
            saving: false,
            serverError: null,
            errorTooltip: false,
        };
    }

    getStateFromConfig(config: Props['config']) {
        return {
            termsEnabled: config.SupportSettings?.CustomTermsOfServiceEnabled,
            reAcceptancePeriod: this.parseIntNonZero(String(config.SupportSettings?.CustomTermsOfServiceReAcceptancePeriod), Constants.DEFAULT_TERMS_OF_SERVICE_RE_ACCEPTANCE_PERIOD),
        };
    }

    getConfigFromState = (config: Props['config']) => {
        if (config && config.SupportSettings) {
            config.SupportSettings.CustomTermsOfServiceEnabled = Boolean(this.state.termsEnabled);
            config.SupportSettings.CustomTermsOfServiceReAcceptancePeriod = this.parseIntNonZero(String(this.state.reAcceptancePeriod), Constants.DEFAULT_TERMS_OF_SERVICE_RE_ACCEPTANCE_PERIOD);
        }
        return config;
    };

    componentDidMount() {
        this.getTermsOfService();
    }

    doSubmit = async (callback?: () => void) => {
        this.setState({
            saving: true,
            serverError: null,
        });

        if (this.state.termsEnabled && (this.state.receivedTermsText !== this.state.termsText || !this.props.config?.SupportSettings?.CustomTermsOfServiceEnabled)) {
            const result = await this.props.actions.createTermsOfService(this.state.termsText);
            if (result.error) {
                this.handleAPIError(result.error, callback);
                return;
            }
        }

        // clone config so that we aren't modifying data in the stores
        let config = JSON.parse(JSON.stringify(this.props.config));
        config = this.getConfigFromState(config);

        const {data, error} = await this.props.updateConfig(config);

        if (data) {
            this.setState(this.getStateFromConfig(data));

            this.setState({
                saveNeeded: false,
                saving: false,
            });

            this.props.setNavigationBlocked(false);

            if (callback) {
                callback();
            }

            if (this.handleSaved) {
                this.handleSaved(config);
            }
        } else if (error) {
            this.handleAPIError({id: error.server_error_id, ...error}, callback, config);
        }
    };

    handleAPIError = (err: any, callback?: (() => void), config?: Props['config']) => {
        this.setState({
            saving: false,
            serverError: err.message,
            serverErrorId: err.id,
        });

        if (callback) {
            callback();
        }

        if (this.handleSaved && config) {
            this.handleSaved(config as AdminConfig);
        }
    };

    getTermsOfService = async () => {
        this.setState({loadingTermsText: true});

        const {data} = await this.props.actions.getTermsOfService();
        if (data) {
            this.setState({
                termsText: data.text,
                receivedTermsText: data.text,
            });
        }

        this.setState({loadingTermsText: false});
    };

    handleTermsTextChange = (id: string, value: boolean) => {
        this.handleChange('termsText', value);
    };

    handleTermsEnabledChange = (id: string, value: boolean) => {
        this.handleChange('termsEnabled', value);
    };

    handleReAcceptancePeriodChange = (id: string, value: boolean) => {
        this.handleChange('reAcceptancePeriod', value);
    };

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.support.termsOfServiceTitle'
                defaultMessage='Custom Terms of Service'
            />
        );
    }

    renderSettings = () => {
        if (this.state.loadingTermsText) {
            return <LoadingScreen/>;
        }

        return (
            <SettingsGroup>
                <BooleanSetting
                    key={'customTermsOfServiceEnabled'}
                    id={'SupportSettings.CustomTermsOfServiceEnabled'}
                    label={
                        <FormattedMessage
                            id='admin.support.enableTermsOfServiceTitle'
                            defaultMessage='Enable Custom Terms of Service'
                        />
                    }
                    helpText={
                        <FormattedMarkdownMessage
                            id='admin.support.enableTermsOfServiceHelp'
                            defaultMessage='When true, new users must accept the terms of service before accessing any Mattermost teams on desktop, web or mobile. Existing users must accept them after login or a page refresh.\n \nTo update terms of service link displayed in account creation and login pages, go to [Site Configuration > Customization](../site_config/customization).'
                        />
                    }
                    value={Boolean(this.state.termsEnabled)}
                    onChange={this.handleTermsEnabledChange}
                    setByEnv={this.isSetByEnv('SupportSettings.CustomTermsOfServiceEnabled')}
                    disabled={this.props.isDisabled || !(this.props.license.IsLicensed && this.props.license.CustomTermsOfService === 'true')}
                />
                <TextSetting
                    key={'customTermsOfServiceText'}
                    id={'SupportSettings.CustomTermsOfServiceText'}
                    type={'textarea'}
                    label={
                        <FormattedMessage
                            id='admin.support.termsOfServiceTextTitle'
                            defaultMessage='Custom Terms of Service Text'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.support.termsOfServiceTextHelp'
                            defaultMessage='Text that will appear in your custom Terms of Service. Supports Markdown-formatted text.'
                        />
                    }
                    onChange={this.handleTermsTextChange}
                    setByEnv={this.isSetByEnv('SupportSettings.CustomTermsOfServiceText')}
                    value={this.state.termsText}
                    maxLength={Constants.MAX_TERMS_OF_SERVICE_TEXT_LENGTH}
                    disabled={this.props.isDisabled || !this.state.termsEnabled}
                />
                <TextSetting
                    key={'customTermsOfServiceReAcceptancePeriod'}
                    id={'SupportSettings.CustomTermsOfServiceReAcceptancePeriod'}
                    type={'number'}
                    label={
                        <FormattedMessage
                            id='admin.support.termsOfServiceReAcceptanceTitle'
                            defaultMessage='Re-Acceptance Period:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.support.termsOfServiceReAcceptanceHelp'
                            defaultMessage='The number of days before Terms of Service acceptance expires, and the terms must be re-accepted.'
                        />
                    }
                    value={this.state.reAcceptancePeriod || ''}
                    onChange={this.handleReAcceptancePeriodChange}
                    setByEnv={this.isSetByEnv('SupportSettings.CustomTermsOfServiceReAcceptancePeriod')}
                    disabled={this.props.isDisabled || !this.state.termsEnabled}
                />
            </SettingsGroup>
        );
    };
}
