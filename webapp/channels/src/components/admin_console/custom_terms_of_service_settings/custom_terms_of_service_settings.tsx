// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import {Link} from 'react-router-dom';

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';
import type {TermsOfService} from '@mattermost/types/terms_of_service';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BooleanSetting from 'components/admin_console/boolean_setting';
import OLDAdminSettings from 'components/admin_console/old_admin_settings';
import type {BaseProps, BaseState} from 'components/admin_console/old_admin_settings';
import SettingsGroup from 'components/admin_console/settings_group';
import TextSetting from 'components/admin_console/text_setting';
import LoadingScreen from 'components/loading_screen';

import {Constants} from 'utils/constants';

type Props = BaseProps & {
    actions: {
        getTermsOfService: () => Promise<ActionResult<TermsOfService>>;
        createTermsOfService: (text: string) => Promise<ActionResult<TermsOfService>>;
    };
    config: AdminConfig;
    license: ClientLicense;
    setNavigationBlocked: () => void;

    /*
     * Action to save config file
     */
    patchConfig: () => void;
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

export const messages = defineMessages({
    termsOfServiceTitle: {id: 'admin.support.termsOfServiceTitle', defaultMessage: 'Custom Terms of Service'},
    enableTermsOfServiceTitle: {id: 'admin.support.enableTermsOfServiceTitle', defaultMessage: 'Enable Custom Terms of Service'},
    termsOfServiceTextTitle: {id: 'admin.support.termsOfServiceTextTitle', defaultMessage: 'Custom Terms of Service Text'},
    termsOfServiceTextHelp: {id: 'admin.support.termsOfServiceTextHelp', defaultMessage: 'Text that will appear in your custom Terms of Service. Supports Markdown-formatted text.'},
    termsOfServiceReAcceptanceTitle: {id: 'admin.support.termsOfServiceReAcceptanceTitle', defaultMessage: 'Re-Acceptance Period:'},
    termsOfServiceReAcceptanceHelp: {id: 'admin.support.termsOfServiceReAcceptanceHelp', defaultMessage: 'The number of days before Terms of Service acceptance expires, and the terms must be re-accepted.'},
    enableTermsOfServiceHelp: {id: 'admin.support.enableTermsOfServiceHelp', defaultMessage: 'When true, new users must accept the terms of service before accessing any Mattermost teams on desktop, web or mobile. Existing users must accept them after login or a page refresh. To update terms of service link displayed in account creation and login pages, go to <a>Site Configuration > Customization</a>'},
});

export const searchableStrings = [
    messages.termsOfServiceTitle,
    messages.enableTermsOfServiceTitle,
    messages.enableTermsOfServiceHelp,
    messages.termsOfServiceTextTitle,
    messages.termsOfServiceTextHelp,
    messages.termsOfServiceReAcceptanceTitle,
    messages.termsOfServiceReAcceptanceHelp,
];

export default class CustomTermsOfServiceSettings extends OLDAdminSettings<Props, State> {
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

        const {data, error} = await this.props.patchConfig(config);

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
        return (<FormattedMessage {...messages.termsOfServiceTitle}/>);
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
                    label={<FormattedMessage {...messages.enableTermsOfServiceTitle}/>}
                    helpText={
                        <FormattedMessage
                            {...messages.enableTermsOfServiceHelp}
                            values={{
                                a: (chunks: string) => <Link to='/admin_console/site_config/customization'>{chunks}</Link>,
                            }}
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
                    label={<FormattedMessage {...messages.termsOfServiceTextTitle}/>}
                    helpText={<FormattedMessage {...messages.termsOfServiceTextHelp}/>}
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
                    label={<FormattedMessage {...messages.termsOfServiceReAcceptanceTitle}/>}
                    helpText={<FormattedMessage {...messages.termsOfServiceReAcceptanceHelp}/>}
                    value={this.state.reAcceptancePeriod || ''}
                    onChange={this.handleReAcceptancePeriodChange}
                    setByEnv={this.isSetByEnv('SupportSettings.CustomTermsOfServiceReAcceptancePeriod')}
                    disabled={this.props.isDisabled || !this.state.termsEnabled}
                />
            </SettingsGroup>
        );
    };
}
