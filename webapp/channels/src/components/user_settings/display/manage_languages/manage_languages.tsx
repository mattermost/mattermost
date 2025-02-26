// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';
import ReactSelect from 'react-select';
import type {ValueType} from 'react-select';

import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ExternalLink from 'components/external_link';
import SettingItemMax from 'components/setting_item_max';

import type {Language} from 'i18n/i18n';
import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

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

type SelectedOption = {
    value: string;
    label: string;
}

type State = {
    isSaving: boolean;
    openMenu: boolean;
    locale: string;
    serverError?: string;
    selectedOption: SelectedOption;
};

export class ManageLanguage extends React.PureComponent<Props, State> {
    reactSelectContainer: React.RefObject<HTMLDivElement>;
    constructor(props: Props) {
        super(props);
        const userLocale = props.locale;
        const selectedOption = {
            value: props.locales[userLocale].value,
            label: props.locales[userLocale].name,
        };
        this.reactSelectContainer = React.createRef();

        this.state = {
            locale: props.locale,
            selectedOption,
            isSaving: false,
            openMenu: false,
        };
    }

    componentDidMount() {
        const reactSelectContainer = this.reactSelectContainer.current;
        if (reactSelectContainer) {
            reactSelectContainer.addEventListener(
                'keydown',
                this.handleContainerKeyDown,
            );
        }
    }

    componentWillUnmount() {
        if (this.reactSelectContainer.current) {
            this.reactSelectContainer.current.removeEventListener(
                'keydown',
                this.handleContainerKeyDown,
            );
        }
    }

    handleContainerKeyDown = (e: KeyboardEvent) => {
        const modalBody = document.querySelector('.modal-body');
        if (isKeyPressed(e, Constants.KeyCodes.ESCAPE) && this.state.openMenu) {
            modalBody?.classList.remove('no-scroll');
            this.setState({openMenu: false});
            e.stopPropagation();
        }
    };

    handleKeyDown = (e: React.KeyboardEvent) => {
        const modalBody = document.querySelector('.modal-body');
        if (isKeyPressed(e, Constants.KeyCodes.ENTER)) {
            modalBody?.classList.add('no-scroll');
            this.setState({openMenu: true});
        }
    };

    setLanguage = (selectedOption: ValueType<SelectedOption>) => {
        if (selectedOption && 'value' in selectedOption) {
            this.setState({
                locale: selectedOption.value,
                selectedOption,
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

    handleMenuClose = () => {
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            modalBody.classList.remove('no-scroll');
        }
        this.setState({openMenu: false});
    };

    handleMenuOpen = () => {
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            modalBody.classList.add('no-scroll');
        }
        this.setState({openMenu: true});
    };

    render() {
        const {intl, locales} = this.props;

        let serverError;
        if (this.state.serverError) {
            serverError = (
                <label className='has-error'>{this.state.serverError}</label>
            );
        }

        const options: SelectedOption[] = [];

        const languages = Object.keys(locales).
            map((l) => {
                return {
                    value: locales[l].value as string,
                    name: locales[l].name,
                    order: locales[l].order,
                };
            }).
            sort((a, b) => a.order - b.order);

        languages.forEach((lang) => {
            options.push({value: lang.value, label: lang.name});
        });

        const reactStyles = {
            menuPortal: (provided: React.CSSProperties) => ({
                ...provided,
                zIndex: 9999,
            }),
        };
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
                <div
                    ref={this.reactSelectContainer}
                    className='pt-2'
                >
                    <ReactSelect
                        className='react-select react-select-top'
                        classNamePrefix='react-select'
                        id='displayLanguage'
                        menuIsOpen={this.state.openMenu}
                        menuPortalTarget={document.body}
                        styles={reactStyles}
                        options={options}
                        clearable={false}
                        onChange={this.setLanguage}
                        onKeyDown={this.handleKeyDown}
                        value={this.state.selectedOption}
                        onMenuClose={this.handleMenuClose}
                        onMenuOpen={this.handleMenuOpen}
                        aria-labelledby='changeInterfaceLanguageLabel'
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
            />
        );
    }
}
export default injectIntl(ManageLanguage);
