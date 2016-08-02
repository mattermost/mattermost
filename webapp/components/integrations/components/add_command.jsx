// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import BackstageHeader from 'components/backstage/components/backstage_header.jsx';
import {FormattedMessage} from 'react-intl';
import FormError from 'components/form_error.jsx';
import {browserHistory, Link} from 'react-router/es6';
import SpinnerButton from 'components/spinner_button.jsx';
import Constants from 'utils/constants.jsx';

const REQUEST_POST = 'P';
const REQUEST_GET = 'G';

export default class AddCommand extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.updateDisplayName = this.updateDisplayName.bind(this);
        this.updateDescription = this.updateDescription.bind(this);
        this.updateTrigger = this.updateTrigger.bind(this);
        this.updateUrl = this.updateUrl.bind(this);
        this.updateMethod = this.updateMethod.bind(this);
        this.updateUsername = this.updateUsername.bind(this);
        this.updateIconUrl = this.updateIconUrl.bind(this);
        this.updateAutocomplete = this.updateAutocomplete.bind(this);
        this.updateAutocompleteHint = this.updateAutocompleteHint.bind(this);
        this.updateAutocompleteDescription = this.updateAutocompleteDescription.bind(this);

        this.state = {
            displayName: '',
            description: '',
            trigger: '',
            url: '',
            method: REQUEST_POST,
            username: '',
            iconUrl: '',
            autocomplete: false,
            autocompleteHint: '',
            autocompleteDescription: '',
            saving: false,
            serverError: '',
            clientError: null
        };
    }

    handleSubmit(e) {
        e.preventDefault();

        if (this.state.saving) {
            return;
        }

        this.setState({
            saving: true,
            serverError: '',
            clientError: ''
        });

        const command = {
            display_name: this.state.displayName,
            description: this.state.description,
            trigger: this.state.trigger.trim().toLowerCase(),
            url: this.state.url.trim(),
            method: this.state.method,
            username: this.state.username,
            icon_url: this.state.iconUrl,
            auto_complete: this.state.autocomplete
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
                )
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
                )
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
                )
            });
            return;
        }

        if (command.trigger.length < Constants.MIN_TRIGGER_LENGTH || command.trigger.length > Constants.MAX_TRIGGER_LENGTH) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_command.triggerInvalidLength'
                        defaultMessage='A trigger word must contain between {min} and {max} characters'
                        values={{
                            min: Constants.MIN_TRIGGER_LENGTH,
                            max: Constants.MAX_TRIGGER_LENGTH
                        }}
                    />
                )
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
                )
            });

            return;
        }

        AsyncClient.addCommand(
            command,
            () => {
                browserHistory.push('/' + this.props.team.name + '/integrations/commands');
            },
            (err) => {
                this.setState({
                    saving: false,
                    serverError: err.message
                });
            }
        );
    }

    updateDisplayName(e) {
        this.setState({
            displayName: e.target.value
        });
    }

    updateDescription(e) {
        this.setState({
            description: e.target.value
        });
    }

    updateTrigger(e) {
        this.setState({
            trigger: e.target.value
        });
    }

    updateUrl(e) {
        this.setState({
            url: e.target.value
        });
    }

    updateMethod(e) {
        this.setState({
            method: e.target.value
        });
    }

    updateUsername(e) {
        this.setState({
            username: e.target.value
        });
    }

    updateIconUrl(e) {
        this.setState({
            iconUrl: e.target.value
        });
    }

    updateAutocomplete(e) {
        this.setState({
            autocomplete: e.target.checked
        });
    }

    updateAutocompleteHint(e) {
        this.setState({
            autocompleteHint: e.target.value
        });
    }

    updateAutocompleteDescription(e) {
        this.setState({
            autocompleteDescription: e.target.value
        });
    }

    render() {
        let autocompleteFields = null;
        if (this.state.autocomplete) {
            autocompleteFields = [(
                <div
                    key='autocompleteHint'
                    className='form-group'
                >
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
                        <input
                            id='autocompleteHint'
                            type='text'
                            maxLength='1024'
                            className='form-control'
                            value={this.state.autocompleteHint}
                            onChange={this.updateAutocompleteHint}
                            placeholder={Utils.localizeMessage('add_command.autocompleteHint.placeholder', 'Example: [Patient Name]')}
                        />
                        <div className='form__help'>
                            <FormattedMessage
                                id='add_command.autocompleteHint.help'
                                defaultMessage='(Optional) Arguments associated with your slash command, displayed as help in the autocomplete list.'
                            />
                        </div>
                    </div>
                </div>
            ),
            (
                <div
                    key='autocompleteDescription'
                    className='form-group'
                >
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
                        <input
                            id='description'
                            type='text'
                            maxLength='128'
                            className='form-control'
                            value={this.state.autocompleteDescription}
                            onChange={this.updateAutocompleteDescription}
                            placeholder={Utils.localizeMessage('add_command.autocompleteDescription.placeholder', 'Example: "Returns search results for patient records"')}
                        />
                        <div className='form__help'>
                            <FormattedMessage
                                id='add_command.autocompleteDescription.help'
                                defaultMessage='(Optional) Short description of slash command for the autocomplete list.'
                            />
                        </div>
                    </div>
                </div>
            )];
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
                        id='add_command.header'
                        defaultMessage='Add'
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
                                    defaultMessage='Display Name'
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
                                        defaultMessage='Display name for your slash command made of up to 64 characters.'
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
                                        defaultMessage='Description for your incoming webhook.'
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
                                <input
                                    id='trigger'
                                    type='text'
                                    maxLength={Constants.MAX_TRIGGER_LENGTH}
                                    className='form-control'
                                    value={this.state.trigger}
                                    onChange={this.updateTrigger}
                                    placeholder={Utils.localizeMessage('add_command.trigger.placeholder', 'Command trigger e.g. "hello" not including the slash')}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.trigger.help'
                                        defaultMessage='Trigger word must be unique, and cannot begin with a slash or contain any spaces.'
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
                                                <a
                                                    href='https://docs.mattermost.com/help/messaging/executing-commands.html#built-in-commands'
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                >
                                                    <FormattedMessage
                                                        id='add_command.trigger.helpReservedLinkText'
                                                        defaultMessage='see list of built-in slash commands'
                                                    />
                                                </a>
                                            )
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
                                <input
                                    id='url'
                                    type='text'
                                    maxLength='1024'
                                    className='form-control'
                                    value={this.state.url}
                                    onChange={this.updateUrl}
                                    placeholder={Utils.localizeMessage('add_command.url.placeholder', 'Must start with http:// or https://')}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.url.help'
                                        defaultMessage='The callback URL to receive the HTTP POST or GET event request when the slash command is run.'
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
                                        defaultMessage='The type of command request issued to the Request URL.'
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
                                <input
                                    id='username'
                                    type='text'
                                    maxLength='64'
                                    className='form-control'
                                    value={this.state.username}
                                    onChange={this.updateUsername}
                                    placholder={Utils.localizeMessage('add_command.username.placeholder', 'Username')}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.username.help'
                                        defaultMessage='(Optional) Choose a username override for responses for this slash command. Usernames can consist of up to 22 characters consisting of lowercase letters, numbers and they symbols "-", "_", and "." .'
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
                                <input
                                    id='iconUrl'
                                    type='text'
                                    maxLength='1024'
                                    className='form-control'
                                    value={this.state.iconUrl}
                                    onChange={this.updateIconUrl}
                                    placeholder={Utils.localizeMessage('add_command.iconUrl.placeholder', 'https://www.example.com/myicon.png')}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_command.iconUrl.help'
                                        defaultMessage='(Optional) Choose a profile picture override for the post responses to this slash command. Enter the URL of a .png or .jpg file at least 128 pixels by 128 pixels.'
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
                                    id='add_command.iconUrl'
                                    defaultMessage='Response Icon'
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
                                        defaultMessage='(Optional) Show slash command in autocomplete list.'
                                    />
                                </div>
                            </div>
                        </div>
                        {autocompleteFields}
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                errors={[this.state.serverError, this.state.clientError]}
                            />
                            <Link
                                className='btn btn-sm'
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
                                onClick={this.handleSubmit}
                            >
                                <FormattedMessage
                                    id='add_command.save'
                                    defaultMessage='Save'
                                />
                            </SpinnerButton>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}
