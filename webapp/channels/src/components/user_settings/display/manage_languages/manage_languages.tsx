// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {Combobox} from '@mattermost/compass-ui/components/combobox';
import type {ComboboxOption} from '@mattermost/compass-ui/components/combobox';

import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ExternalLink from 'components/external_link';
import SettingItemMax from 'components/setting_item_max';

import type {Language} from 'i18n/i18n';

type Actions = {
    updateMe: (user: UserProfile) => Promise<ActionResult>;
    patchUser: (user: UserProfile) => Promise<ActionResult>;
};

type Props = {
    intl: IntlShape;
    user: UserProfile;
    locale: string;
    locales: Record<string, Language>;
    updateSection: (section: string) => void;
    actions: Actions;
    adminMode?: boolean;
};

type State = {
    isSaving: boolean;
    locale: string;
    serverError?: string;
};

export class ManageLanguage extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            locale: props.locale,
            isSaving: false,
        };
    }

    setLanguage = (selectedLocale: string | string[] | null) => {
        if (typeof selectedLocale === 'string') {
            this.setState({
                locale: selectedLocale,
            });
        }
    };

    changeLanguage = () => {
        if (this.props.user.locale === this.state.locale) {
            this.props.updateSection('');
        } else {
            this.submitUser({
                ...this.props.user,
                locale: this.state.locale,
            });
        }
    };

    submitUser = (user: UserProfile) => {
        this.setState({isSaving: true});

        const action = this.props.adminMode ? this.props.actions.patchUser : this.props.actions.updateMe;
        action(user).then((res) => {
            if ('data' in res) {
                this.setState({isSaving: false});
            } else if ('error' in res) {
                let serverError;
                const {error} = res;
                if (error instanceof Error) {
                    serverError = error.message;
                } else {
                    serverError = error;
                }
                this.setState({serverError, isSaving: false});
            }
        });
    };

    render() {
        const {intl, locales} = this.props;

        let serverError;
        if (this.state.serverError) {
            serverError = (
                <label className='has-error'>{this.state.serverError}</label>
            );
        }

        const options: ComboboxOption[] = Object.keys(locales).
            map((l) => ({
                value: locales[l].value as string,
                label: locales[l].name,
                order: locales[l].order,
            })).
            sort((a, b) => a.order - b.order).
            map(({value, label}) => ({value, label}));

        const interfaceLanguageLabelAria = intl.formatMessage({id: 'user.settings.languages.dropdown.arialabel', defaultMessage: 'Dropdown selector to change the interface language'});

        const input = (
            <div key='changeLanguage'>
                <br/>
                <label
                    aria-label={interfaceLanguageLabelAria}
                    className='control-label'
                    id='changeInterfaceLanguageLabel'
                    htmlFor='displayLanguage'
                >
                    <FormattedMessage
                        id='user.settings.languages.change'
                        defaultMessage='Change interface language'
                    />
                </label>
                <div className='pt-2'>
                    <Combobox
                        className='react-select react-select-top'
                        id='displayLanguage'
                        options={options}
                        value={this.state.locale}
                        onChange={this.setLanguage}
                        aria-label={interfaceLanguageLabelAria}
                        portalContainer={document.body}
                        zIndex={9999}
                    />
                    {serverError}
                </div>
                <div>
                    <br/>
                    <FormattedMessage
                        id='user.settings.languages.promote1'
                        defaultMessage='Select which language Mattermost displays in the user interface.'
                    />
                    <p/>
                    <FormattedMessage
                        id='user.settings.languages.promote2'
                        defaultMessage='Would you like to help with translations? Join the <link>Mattermost Translation Server</link> to contribute.'
                        values={{
                            link: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href='http://translate.mattermost.com'
                                    location='manage_languages'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />
                </div>
            </div>
        );

        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.display.language'
                        defaultMessage='Language'
                    />
                }
                submit={this.changeLanguage}
                saving={this.state.isSaving}
                inputs={[input]}
                updateSection={this.props.updateSection}
                disableEnterSubmit={true}
            />
        );
    }
}
export default injectIntl(ManageLanguage);
