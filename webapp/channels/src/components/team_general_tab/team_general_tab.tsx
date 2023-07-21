// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';
import React, {ChangeEvent, MouseEvent, ReactNode} from 'react';
import {FormattedMessage, FormattedDate} from 'react-intl';

import LocalizedInput from 'components/localized_input/localized_input';
import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import SettingPicture from 'components/setting_picture';
import BackIcon from 'components/widgets/icons/fa_back_icon';

import Constants from 'utils/constants';
import {t} from 'utils/i18n';
import {imageURLForTeam, isMobile, localizeMessage, moveCursorToEnd} from 'utils/utils';

import OpenInvite from './open_invite';

import {PropsFromRedux, OwnProps} from '.';

const ACCEPTED_TEAM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/bmp'];

type Props = PropsFromRedux & OwnProps;

type State = {
    name?: Team['display_name'];
    invite_id?: Team['invite_id'];
    description?: Team['description'];
    allowed_domains?: Team['allowed_domains'];
    serverError: ReactNode;
    clientError: ReactNode;
    teamIconFile: File | null;
    loadingIcon: boolean;
    submitActive: boolean;
    isInitialState: boolean;
    shouldFetchTeam?: boolean;
}

export default class GeneralTab extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = this.setupInitialState(props);
    }

    updateSection = (section: string) => {
        this.setState(this.setupInitialState(this.props));
        this.props.updateSection(section);
    };

    setupInitialState(props: Props) {
        const team = props.team;

        return {
            name: team?.display_name,
            invite_id: team?.invite_id,
            description: team?.description,
            allowed_domains: team?.allowed_domains,
            serverError: '',
            clientError: '',
            teamIconFile: null,
            loadingIcon: false,
            submitActive: false,
            isInitialState: true,
        };
    }

    static getDerivedStateFromProps(nextProps: Props, prevState: State) {
        const {team} = nextProps;
        if (!prevState.isInitialState) {
            return {
                name: team?.display_name,
                description: team?.description,
                allowed_domains: team?.allowed_domains,
                invite_id: team?.invite_id,
                isInitialState: false,
            };
        }
        return null;
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (!prevState.shouldFetchTeam && this.state.shouldFetchTeam) {
            this.fetchTeam();
        }
    }

    fetchTeam() {
        if (this.state.serverError) {
            return;
        }
        if (this.props.team) {
            this.props.actions.getTeam(this.props.team.id).then(({error}) => {
                const state = {
                    shouldFetchTeam: false,
                    serverError: '',
                };
                if (error) {
                    state.serverError = error.message;
                }
                this.setState(state);
            });
        }
    }

    handleAllowedDomainsSubmit = async () => {
        const state = {serverError: '', clientError: ''};

        const data = {...this.props.team};
        data.allowed_domains = this.state.allowed_domains;

        const {error} = await this.props.actions.patchTeam(data);

        if (error) {
            state.serverError = error.message;
            this.setState(state);
        } else {
            this.updateSection('');
        }
    };

    handleNameSubmit = async () => {
        const state: Pick<State, 'serverError' | 'clientError'> = {serverError: '', clientError: ''};
        let valid = true;

        const name = this.state.name?.trim();

        if (!name) {
            state.clientError = localizeMessage('general_tab.required', 'This field is required');
            valid = false;
        } else if (name.length < Constants.MIN_TEAMNAME_LENGTH) {
            state.clientError = (
                <FormattedMessage
                    id='general_tab.teamNameRestrictions'
                    defaultMessage='Team Name must be {min} or more characters up to a maximum of {max}. You can add a longer team description.'
                    values={{
                        min: Constants.MIN_TEAMNAME_LENGTH,
                        max: Constants.MAX_TEAMNAME_LENGTH,
                    }}
                />
            );

            valid = false;
        } else {
            state.clientError = '';
        }

        this.setState(state);

        if (!valid) {
            return;
        }

        const data = {...this.props.team};
        data.display_name = this.state.name;

        const {error} = await this.props.actions.patchTeam(data);

        if (error) {
            state.serverError = error.message;
            this.setState(state);
        } else {
            this.updateSection('');
        }
    };

    handleInviteIdSubmit = async () => {
        const state = {serverError: '', clientError: ''};
        this.setState(state);

        const {error} = await this.props.actions.regenerateTeamInviteId(this.props.team?.id || '');

        if (error) {
            state.serverError = error.message;
            this.setState(state);
        } else {
            this.updateSection('');
        }
    };

    handleClose = () => this.updateSection('');

    handleDescriptionSubmit = async () => {
        const state = {serverError: '', clientError: ''};
        let valid = true;

        const description = this.state.description?.trim();
        if (description === this.props.team?.description) {
            state.clientError = localizeMessage('general_tab.chooseDescription', 'Please choose a new description for your team');
            valid = false;
        } else {
            state.clientError = '';
        }

        this.setState(state);

        if (!valid) {
            return;
        }

        const data = {...this.props.team};
        data.description = this.state.description;

        const {error} = await this.props.actions.patchTeam(data);

        if (error) {
            state.serverError = error.message;
            this.setState(state);
        } else {
            this.updateSection('');
        }
    };

    handleTeamIconSubmit = async () => {
        if (!this.state.teamIconFile || !this.state.submitActive) {
            return;
        }

        this.setState({
            loadingIcon: true,
            clientError: '',
            serverError: '',
        });

        const {error} = await this.props.actions.setTeamIcon(this.props.team?.id || '', this.state.teamIconFile);

        if (error) {
            this.setState({
                loadingIcon: false,
                serverError: error.message,
            });
        } else {
            this.setState({
                loadingIcon: false,
                submitActive: false,
            });
            this.updateSection('');
        }
    };

    handleTeamIconRemove = async () => {
        this.setState({
            loadingIcon: true,
            clientError: '',
            serverError: '',
        });

        const {error} = await this.props.actions.removeTeamIcon(this.props.team?.id || '');

        if (error) {
            this.setState({
                loadingIcon: false,
                serverError: error.message,
            });
        } else {
            this.setState({
                loadingIcon: false,
                submitActive: false,
            });
            this.updateSection('');
        }
    };

    componentDidMount() {
        document.getElementById('team_settings')?.addEventListener('hidden.bs.modal', this.handleClose);
    }

    componentWillUnmount() {
        document.getElementById('team_settings')?.removeEventListener('hidden.bs.modal', this.handleClose);
    }

    onOpenInviteToggle = (active: boolean) => this.handleUpdateSection(active ? 'open_invite' : '');

    handleUpdateSection = (section: string) => {
        if (section === 'invite_id' && this.props.activeSection !== section && !this.props.team?.invite_id) {
            this.setState({shouldFetchTeam: true}, () => {
                this.updateSection(section);
            });
            return;
        }

        this.updateSection(section);
    };

    updateName = (e: ChangeEvent<HTMLInputElement>) => this.setState({name: e.target.value});

    updateDescription = (e: ChangeEvent<HTMLInputElement>) => this.setState({description: e.target.value});

    updateTeamIcon = (e: ChangeEvent<HTMLInputElement>) => {
        if (e && e.target && e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            if (!ACCEPTED_TEAM_IMAGE_TYPES.includes(file.type)) {
                this.setState({
                    clientError: localizeMessage('general_tab.teamIconInvalidFileType', 'Only BMP, JPG or PNG images may be used for team icons'),
                });
            } else if (file.size > this.props.maxFileSize) {
                this.setState({
                    clientError: localizeMessage('general_tab.teamIconTooLarge', 'Unable to upload team icon. File is too large.'),
                });
            } else {
                this.setState({
                    teamIconFile: e.target.files[0],
                    clientError: '',
                    submitActive: true,
                });
            }
        } else {
            this.setState({
                teamIconFile: null,
                clientError: localizeMessage('general_tab.teamIconError', 'An error occurred while selecting the image.'),
            });
        }
    };

    updateAllowedDomains = (e: ChangeEvent<HTMLInputElement>) => this.setState({allowed_domains: e.target.value});

    render() {
        const team = this.props.team;

        const clientError = this.state.clientError;
        const serverError = this.state.serverError ?? null;

        let inviteSection;

        if (this.props.activeSection === 'invite_id' && this.props.canInviteTeamMembers) {
            const inputs = [];

            inputs.push(
                <div key='teamInviteSetting'>
                    <div className='row'>
                        <label className='col-sm-5 control-label visible-xs-block'/>
                        <div className='col-sm-12'>
                            <input
                                id='teamInviteId'
                                autoFocus={true}
                                className='form-control'
                                type='text'
                                value={this.state.invite_id}
                                maxLength={32}
                                onFocus={moveCursorToEnd}
                                readOnly={true}
                            />
                        </div>
                    </div>
                    <div className='setting-list__hint'>
                        <FormattedMessage
                            id='general_tab.codeLongDesc'
                            defaultMessage='The Invite Code is part of the unique team invitation link which is sent to members you’re inviting to this team. Regenerating the code creates a new invitation link and invalidates the previous link.'
                            values={{
                                getTeamInviteLink: (
                                    <strong>
                                        <FormattedMessage
                                            id='general_tab.getTeamInviteLink'
                                            defaultMessage='Get Team Invite Link'
                                        />
                                    </strong>
                                ),
                            }}
                        />
                    </div>
                </div>,
            );

            inviteSection = (
                <SettingItemMax
                    title={localizeMessage('general_tab.codeTitle', 'Invite Code')}
                    inputs={inputs}
                    submit={this.handleInviteIdSubmit}
                    serverError={serverError}
                    clientError={clientError}
                    updateSection={this.handleUpdateSection}
                    saveButtonText={localizeMessage('general_tab.regenerate', 'Regenerate')}
                />
            );
        } else if (this.props.canInviteTeamMembers) {
            inviteSection = (
                <SettingItemMin
                    title={localizeMessage('general_tab.codeTitle', 'Invite Code')}
                    describe={localizeMessage('general_tab.codeDesc', "Click 'Edit' to regenerate Invite Code.")}
                    updateSection={this.handleUpdateSection}
                    section={'invite_id'}
                />
            );
        }

        let nameSection;

        if (this.props.activeSection === 'name') {
            const inputs = [];

            const teamNameLabel = isMobile() ? '' : (
                <FormattedMessage
                    id='general_tab.teamName'
                    defaultMessage='Team Name'
                />
            );

            inputs.push(
                <div
                    key='teamNameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{teamNameLabel}</label>
                    <div className='col-sm-7'>
                        <input
                            id='teamName'
                            autoFocus={true}
                            className='form-control'
                            type='text'
                            maxLength={Constants.MAX_TEAMNAME_LENGTH}
                            onChange={this.updateName}
                            value={this.state.name}
                            onFocus={moveCursorToEnd}
                        />
                    </div>
                </div>,
            );

            const nameExtraInfo = <span>{localizeMessage('general_tab.teamNameInfo', 'Set the name of the team as it appears on your sign-in screen and at the top of the left-hand sidebar.')}</span>;

            nameSection = (
                <SettingItemMax
                    title={localizeMessage('general_tab.teamName', 'Team Name')}
                    inputs={inputs}
                    submit={this.handleNameSubmit}
                    serverError={serverError}
                    clientError={clientError}
                    updateSection={this.handleUpdateSection}
                    extraInfo={nameExtraInfo}
                />
            );
        } else {
            const describe = this.state.name;

            nameSection = (
                <SettingItemMin
                    title={localizeMessage('general_tab.teamName', 'Team Name')}
                    describe={describe}
                    updateSection={this.handleUpdateSection}
                    section={'name'}
                />
            );
        }

        let descriptionSection;

        if (this.props.activeSection === 'description') {
            const inputs = [];

            const teamDescriptionLabel = isMobile() ? '' : (
                <FormattedMessage
                    id='general_tab.teamDescription'
                    defaultMessage='Team Description'
                />
            );

            inputs.push(
                <div
                    key='teamDescriptionSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{teamDescriptionLabel}</label>
                    <div className='col-sm-7'>
                        <input
                            id='teamDescription'
                            autoFocus={true}
                            className='form-control'
                            type='text'
                            maxLength={Constants.MAX_TEAMDESCRIPTION_LENGTH}
                            onChange={this.updateDescription}
                            value={this.state.description}
                            onFocus={moveCursorToEnd}
                        />
                    </div>
                </div>,
            );

            const descriptionExtraInfo = <span>{localizeMessage('general_tab.teamDescriptionInfo', 'Team description provides additional information to help users select the right team. Maximum of 50 characters.')}</span>;

            descriptionSection = (
                <SettingItemMax
                    title={localizeMessage('general_tab.teamDescription', 'Team Description')}
                    inputs={inputs}
                    submit={this.handleDescriptionSubmit}
                    serverError={serverError}
                    clientError={clientError}
                    updateSection={this.handleUpdateSection}
                    extraInfo={descriptionExtraInfo}
                />
            );
        } else {
            const describeMsg = this.state.description ?? (
                <FormattedMessage
                    id='general_tab.emptyDescription'
                    defaultMessage="Click 'Edit' to add a team description."
                />
            );

            descriptionSection = (
                <SettingItemMin
                    title={localizeMessage('general_tab.teamDescription', 'Team Description')}
                    describe={describeMsg}
                    updateSection={this.handleUpdateSection}
                    section={'description'}
                />
            );
        }

        let teamIconSection;
        if (this.props.activeSection === 'team_icon') {
            const helpText = (
                <FormattedMessage
                    id='setting_picture.help.team'
                    defaultMessage='Upload a team icon in BMP, JPG or PNG format.\nSquare images with a solid background color are recommended.'
                />
            );
            teamIconSection = (
                <SettingPicture
                    imageContext='team'
                    title={localizeMessage('general_tab.teamIcon', 'Team Icon')}
                    src={imageURLForTeam(team || {} as Team)}
                    file={this.state.teamIconFile}
                    serverError={this.state.serverError}
                    clientError={this.state.clientError}
                    loadingPicture={this.state.loadingIcon}
                    submitActive={this.state.submitActive}
                    updateSection={(e: MouseEvent<HTMLButtonElement>) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                    onFileChange={this.updateTeamIcon}
                    onSubmit={this.handleTeamIconSubmit}
                    onRemove={this.handleTeamIconRemove}
                    helpText={helpText}
                />
            );
        } else {
            let minMessage;

            if (team?.last_team_icon_update) {
                minMessage = (
                    <FormattedMessage
                        id='general_tab.teamIconLastUpdated'
                        defaultMessage='Image last updated {date}'
                        values={{
                            date: (
                                <FormattedDate
                                    value={new Date(team.last_team_icon_update)}
                                    day='2-digit'
                                    month='short'
                                    year='numeric'
                                />
                            ),
                        }}
                    />
                );
            } else {
                minMessage = isMobile() ? localizeMessage('general_tab.teamIconEditHintMobile', 'Click to upload an image') : localizeMessage('general_tab.teamIconEditHint', 'Click \'Edit\' to upload an image.');
            }

            teamIconSection = (
                <SettingItemMin
                    title={localizeMessage('general_tab.teamIcon', 'Team Icon')}
                    describe={minMessage}
                    section={'team_icon'}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        let allowedDomainsSection;

        if (this.props.activeSection === 'allowed_domains') {
            const inputs = [];

            inputs.push(
                <div
                    key='allowedDomainsSetting'
                    className='form-group'
                >
                    <div className='col-sm-12'>
                        <LocalizedInput
                            id='allowedDomains'
                            autoFocus={true}
                            className='form-control'
                            type='text'
                            onChange={this.updateAllowedDomains}
                            value={this.state.allowed_domains}
                            onFocus={moveCursorToEnd}
                            placeholder={{id: t('general_tab.AllowedDomainsExample'), defaultMessage: 'corp.mattermost.com, mattermost.com'}}
                            aria-label={localizeMessage('general_tab.allowedDomains.ariaLabel', 'Allowed Domains')}
                        />
                    </div>
                </div>,
            );

            const allowedDomainsInfo = <span>{localizeMessage('general_tab.AllowedDomainsInfo', 'Users can only join the team if their email matches a specific domain (e.g. "mattermost.com") or list of comma-separated domains (e.g. "corp.mattermost.com, mattermost.com").')}</span>;

            allowedDomainsSection = (
                <SettingItemMax
                    title={localizeMessage('general_tab.allowedDomains', 'Allow only users with a specific email domain to join this team')}
                    inputs={inputs}
                    submit={this.handleAllowedDomainsSubmit}
                    serverError={serverError}
                    clientError={clientError}
                    updateSection={this.handleUpdateSection}
                    extraInfo={allowedDomainsInfo}
                />
            );
        } else {
            const describeMsg = this.state.allowed_domains ?? (
                <FormattedMessage
                    id='general_tab.allowedDomainsEdit'
                    defaultMessage="Click 'Edit' to add an email domain whitelist."
                />
            );
            allowedDomainsSection = (
                <SettingItemMin
                    title={localizeMessage('general_tab.allowedDomains', 'allowedDomains')}
                    describe={describeMsg}
                    updateSection={this.handleUpdateSection}
                    section={'allowed_domains'}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        id='closeButton'
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4 className='modal-title'>
                        <div className='modal-back'>
                            <span onClick={this.props.collapseModal}>
                                <BackIcon/>
                            </span>
                        </div>
                        <FormattedMessage
                            id='general_tab.title'
                            defaultMessage='General Settings'
                        />
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='general_tab.title'
                            defaultMessage='General Settings'
                        />
                    </h3>
                    <div className='divider-dark first'/>
                    {nameSection}
                    <div className='divider-light'/>
                    {descriptionSection}
                    <div className='divider-light'/>
                    {teamIconSection}
                    {!team?.group_constrained &&
                        <>
                            <div className='divider-light'/>
                            {allowedDomainsSection}
                        </>
                    }
                    <div className='divider-light'/>
                    <OpenInvite
                        teamId={this.props.team?.id}
                        isActive={this.props.activeSection === 'open_invite'}
                        isGroupConstrained={this.props.team?.group_constrained}
                        allowOpenInvite={this.props.team?.allow_open_invite}
                        onToggle={this.onOpenInviteToggle}
                        patchTeam={this.props.actions.patchTeam}
                    />
                    {!team?.group_constrained &&
                        <>
                            <div className='divider-light'/>
                            {inviteSection}
                        </>
                    }
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}
