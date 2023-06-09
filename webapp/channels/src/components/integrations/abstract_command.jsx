// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import BackstageHeader from 'components/backstage/components/backstage_header';
import Constants from 'utils/constants';
import * as Utils from 'utils/utils';
import FormError from 'components/form_error';
import SpinnerButton from 'components/spinner_button';
import LocalizedInput from 'components/localized_input/localized_input';

import {t} from 'utils/i18n';
import ExternalLink from 'components/external_link';

const REQUEST_POST = 'P';
const REQUEST_GET = 'G';

export default class AbstractCommand extends React.PureComponent {
    static propTypes = {

        /**
        * The current team
        */
        team: PropTypes.object.isRequired,

        /**
        * The header text to render, has id and defaultMessage
        */
        header: PropTypes.object.isRequired,

        /**
        * The footer text to render, has id and defaultMessage
        */
        footer: PropTypes.object.isRequired,

        /**
        * The spinner loading text to render, has id and defaultMessage
        */
        loading: PropTypes.object.isRequired,

        /**
         * Any extra component/node to render
         */
        renderExtra: PropTypes.node.isRequired,

        /**
        * The server error text after a failed action
        */
        serverError: PropTypes.string.isRequired,

        /**
        * The Command used to set the initial state
        */
        initialCommand: PropTypes.object,

        /**
        * The async function to run when the action button is pressed
        */
        action: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = this.getStateFromCommand(this.props.initialCommand || {});
    }

    getStateFromCommand = (command) => {
        return {
            displayName: command.display_name || '',
            description: command.description || '',
            trigger: command.trigger || '',
            url: command.url || '',
            method: command.method || REQUEST_POST,
            username: command.username || '',
            iconUrl: command.icon_url || '',
            autocomplete: command.auto_complete || false,
            autocompleteHint: command.auto_complete_hint || '',
            autocompleteDescription: command.auto_complete_desc || '',
            saving: false,
            clientError: null,
        };
    };

    handleSubmit = (e) => {
        e.preventDefault();

        if (this.state.saving) {
            return;
        }

        this.setState({
            saving: true,
            clientError: '',
        });

        let triggerWord = this.state.trigger.trim().toLowerCase();
        if (triggerWord.indexOf('/') === 0) {
            triggerWord = triggerWord.substr(1);
        }

        const command = {
            display_name: this.state.displayName,
            description: this.state.description,
            trigger: triggerWord,
            url: this.state.url.trim(),
            method: this.state.method,
            username: this.state.username,
            icon_url: this.state.iconUrl,
            auto_complete: this.state.autocomplete,
            team_id: this.props.team.id,
        };

        if (command.auto_complete) {
            command.auto_complete_desc = this.state.autocompleteDescription;
            command.auto_complete_hint = this.state.autocompleteHint;
        }

        if (!command.trigger) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_command.triggerRequired'
                        defaultMessage='A trigger word is required'
                    />
                ),
            });

            return;
        }

        if (command.trigger.indexOf('/') === 0) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_command.triggerInvalidSlash'
                        defaultMessage='A trigger word cannot begin with a /'
                    />
                ),
            });

            return;
        }

        if (command.trigger.indexOf(' ') !== -1) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_command.triggerInvalidSpace'
                        defaultMessage='A trigger word must not contain spaces'
                    />
                ),
            });
            return;
        }

        if (command.trigger.length < Constants.MIN_TRIGGER_LENGTH ||
            command.trigger.length > Constants.MAX_TRIGGER_LENGTH) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_command.triggerInvalidLength'
                        defaultMessage='A trigger word must contain between {min} and {max} characters'
                        values={{
                            min: Constants.MIN_TRIGGER_LENGTH,
                            max: Constants.MAX_TRIGGER_LENGTH,
                        }}
                    />
                ),
            });

            return;
        }

        if (!command.url) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_command.urlRequired'
                        defaultMessage='A request URL is required'
                    />
                ),
            });

            return;
        }

        this.props.action(command).then(() => this.setState({saving: false}));
    };

    updateDisplayName = (e) => {
        this.setState({
            displayName: e.target.value,
        });
    };

    updateDescription = (e) => {
        this.setState({
            description: e.target.value,
        });
    };

    updateTrigger = (e) => {
        this.setState({
            trigger: e.target.value,
        });
    };

    updateUrl = (e) => {
        this.setState({
            url: e.target.value,
        });
    };

    updateMethod = (e) => {
        this.setState({
            method: e.target.value,
        });
    };

    updateUsername = (e) => {
        this.setState({
            username: e.target.value,
        });
    };

    updateIconUrl = (e) => {
        this.setState({
            iconUrl: e.target.value,
        });
    };

    updateAutocomplete = (e) => {
        this.setState({
            autocomplete: e.target.checked,
        });
    };

    updateAutocompleteHint = (e) => {
        this.setState({
            autocompleteHint: e.target.value,
        });
    };

    updateAutocompleteDescription = (e) => {
        this.setState({
            autocompleteDescription: e.target.value,
        });
    };

    render() {
        let autocompleteHint = null;
        let autocompleteDescription = null;

        if (this.state.autocomplete) {
            autocompleteHint = (
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='autocompleteHint'
                    >
                        <FormattedMessage
                            id='add_command.autocompleteHint'
                            defaultMessage='Autocomplete Hint'
                        />
                    </label>
                    <div className='col-md-5 col-sm-8'>
                        <LocalizedInput
                            id='autocompleteHint'
                            type='text'
                            maxLength='1024'
                            className='form-control'
                            value={this.state.autocompleteHint}
                            onChange={this.updateAutocompleteHint}
                            placeholder={{id: t('add_command.autocompleteHint.placeholder'), defaultMessage: 'Example: [Patient Name]'}}
                        />
                        <div className='form__help'>
                            <FormattedMessage
                                id='add_command.autocompleteHint.help'
                                defaultMessage='(Optional) Specify the arguments associated with your slash command. These are displayed as help on the autocomplete list.'
                            />
                        </div>
                    </div>
                </div>
            );

            autocompleteDescription = (
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='autocompleteDescription'
                    >
                        <FormattedMessage
                            id='add_command.autocompleteDescription'
                            defaultMessage='Autocomplete Description'
                        />
                    </label>
                    <div className='col-md-5 col-sm-8'>
                        <LocalizedInput
                            id='description'
                            type='text'
                            maxLength='128'
                            className='form-control'
                            value={this.state.autocompleteDescription}
                            onChange={this.updateAutocompleteDescription}
                            placeholder={{id: t('add_command.autocompleteDescription.placeholder'), defaultMessage: 'Example: "Returns search results for patient records"'}}
                        />
                        <div className='form__help'>
                            <FormattedMessage
                                id='add_command.autocompleteDescription.help'
                                defaultMessage='(Optional) Describe your slash command for the autocomplete list.'
                            />
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className='backstage-content row'>
                <BackstageHeader>
                    <Link to={'/' + this.props.team.name + '/integrations/commands'}>
                        <FormattedMessage
                            id='installed_command.header'
                            defaultMessage='Slash Commands'
                        />
                    </Link>
                    <FormattedMessage
                        id={this.props.header.id}
                        defaultMessage={this.props.header.defaultMessage}
                    />
                </BackstageHeader>
                <div className='backstage-form'>
                    <form
                        className='form-horizontal'
                        onSubmit={this.handleSubmit}
                    >
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='displayName'
                            >
                                <FormattedMessage
                                    id='add_command.displayName'
                                    defaultMessage='Title'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='displayName'
                                    type='text'
                                    maxLength='64'
                                    className='form-control'
                                    value={this.state.displayName}
                                    onChange={this.updateDisplayName}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.displayName.help'
                                        defaultMessage='Specify a title, of up to 64 characters, for the slash command settings page.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='description'
                            >
                                <FormattedMessage
                                    id='add_command.description'
                                    defaultMessage='Description'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='description'
                                    type='text'
                                    maxLength='128'
                                    className='form-control'
                                    value={this.state.description}
                                    onChange={this.updateDescription}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.description.help'
                                        defaultMessage='Describe your slash command.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='trigger'
                            >
                                <FormattedMessage
                                    id='add_command.trigger'
                                    defaultMessage='Command Trigger Word'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <LocalizedInput
                                    id='trigger'
                                    type='text'
                                    maxLength={Constants.MAX_TRIGGER_LENGTH}
                                    className='form-control'
                                    value={this.state.trigger}
                                    onChange={this.updateTrigger}
                                    placeholder={{id: t('add_command.trigger.placeholder'), defaultMessage: 'Command trigger e.g. "hello" not including the slash'}}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.trigger.help'
                                        defaultMessage='Specify a trigger word that is not a built-in command, does not contain spaces, and does not begin with the slash character.'
                                    />
                                </div>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.trigger.helpExamples'
                                        defaultMessage='Examples: client, employee, patient, weather'
                                    />
                                </div>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.trigger.helpReserved'
                                        defaultMessage='Reserved: {link}'
                                        values={{
                                            link: (
                                                <ExternalLink
                                                    href='https://developers.mattermost.com/integrate/slash-commands/built-in/'
                                                    location='abstract_command'
                                                >
                                                    <FormattedMessage
                                                        id='add_command.trigger.helpReservedLinkText'
                                                        defaultMessage='See built-in slash commands'
                                                    />
                                                </ExternalLink>
                                            ),
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='url'
                            >
                                <FormattedMessage
                                    id='add_command.url'
                                    defaultMessage='Request URL'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <LocalizedInput
                                    id='url'
                                    type='text'
                                    maxLength='1024'
                                    className='form-control'
                                    value={this.state.url}
                                    onChange={this.updateUrl}
                                    placeholder={{id: t('add_command.url.placeholder'), defaultMessage: 'Must start with http:// or https://'}}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.url.help'
                                        defaultMessage='Specify the callback URL to receive the HTTP POST or GET event request when the slash command is run.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='method'
                            >
                                <FormattedMessage
                                    id='add_command.method'
                                    defaultMessage='Request Method'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <select
                                    id='method'
                                    className='form-control'
                                    value={this.state.method}
                                    onChange={this.updateMethod}
                                >
                                    <option value={REQUEST_POST}>
                                        {Utils.localizeMessage('add_command.method.post', 'POST')}
                                    </option>
                                    <option value={REQUEST_GET}>
                                        {Utils.localizeMessage('add_command.method.get', 'GET')}
                                    </option>
                                </select>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.method.help'
                                        defaultMessage='Specify the type of request, either POST or GET, sent to the endpoint that Mattermost hits to reach your application.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='username'
                            >
                                <FormattedMessage
                                    id='add_command.username'
                                    defaultMessage='Response Username'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <LocalizedInput
                                    id='username'
                                    type='text'
                                    maxLength='64'
                                    className='form-control'
                                    value={this.state.username}
                                    onChange={this.updateUsername}
                                    placeholder={{id: t('add_command.username.placeholder'), defaultMessage: 'Username'}}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.username.help'
                                        defaultMessage='(Optional) Specify the name to use when posting responses for this slash command. Usernames can be up to 22 characters, and contain lowercase letters, numbers, and the symbols \"-\", \"_\", and \".\". If left blank, your Mattermost username is used.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='iconUrl'
                            >
                                <FormattedMessage
                                    id='add_command.iconUrl'
                                    defaultMessage='Response Icon'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <LocalizedInput
                                    id='iconUrl'
                                    type='text'
                                    maxLength='1024'
                                    className='form-control'
                                    value={this.state.iconUrl}
                                    onChange={this.updateIconUrl}
                                    placeholder={{id: t('add_command.iconUrl.placeholder'), defaultMessage: 'https://www.example.com/myicon.png'}}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.iconUrl.help'
                                        defaultMessage='(Optional) Enter the URL of a .png or .jpg file to use as the icon when posting responses to this slash command. The file must be at least 128 pixels by 128 pixels. If left blank, your profile picture is used.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='autocomplete'
                            >
                                <FormattedMessage
                                    id='add_command.autocomplete'
                                    defaultMessage='Autocomplete'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8 checkbox'>
                                <input
                                    id='autocomplete'
                                    type='checkbox'
                                    checked={this.state.autocomplete}
                                    onChange={this.updateAutocomplete}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.autocomplete.help'
                                        defaultMessage='(Optional) Show your slash command on the autocomplete list when someone types "/" in the input box.'
                                    />
                                </div>
                            </div>
                        </div>
                        {autocompleteHint}
                        {autocompleteDescription}
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                errors={[this.props.serverError, this.state.clientError]}
                            />
                            <Link
                                className='btn btn-link btn-sm'
                                to={'/' + this.props.team.name + '/integrations/commands'}
                            >
                                <FormattedMessage
                                    id='add_command.cancel'
                                    defaultMessage='Cancel'
                                />
                            </Link>
                            <SpinnerButton
                                className='btn btn-primary'
                                type='submit'
                                spinning={this.state.saving}
                                spinningText={Utils.localizeMessage(this.props.loading.id, this.props.loading.defaultMessage)}
                                onClick={this.handleSubmit}
                                id='saveCommand'
                            >
                                <FormattedMessage
                                    id={this.props.footer.id}
                                    defaultMessage={this.props.footer.defaultMessage}
                                />
                            </SpinnerButton>
                            {this.props.renderExtra}
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}
