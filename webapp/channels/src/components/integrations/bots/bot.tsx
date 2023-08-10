// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import ConfirmModal from 'components/confirm_modal';
import Markdown from 'components/markdown';
import SaveButton from 'components/save_button';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

import * as Utils from 'utils/utils';

import type {Bot as BotType} from '@mattermost/types/bots';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile, UserAccessToken} from '@mattermost/types/users';
import type {ActionResult} from 'mattermost-redux/types/actions';
import type {ChangeEvent, SyntheticEvent, ReactNode} from 'react';

export function matchesFilter(bot: BotType, filter?: string, owner?: UserProfile): boolean {
    if (!filter) {
        return true;
    }
    const username = bot.username || '';
    const description = bot.description || '';
    const displayName = bot.display_name || '';

    let ownerUsername = 'plugin';
    if (owner && owner.username) {
        ownerUsername = owner.username;
    }
    return !(username.toLowerCase().indexOf(filter) === -1 &&
        displayName.toLowerCase().indexOf(filter) === -1 &&
        description.toLowerCase().indexOf(filter) === -1 &&
        ownerUsername.toLowerCase().indexOf(filter) === -1);
}

type Props = {

    /**
    *  Bot that we are displaying
    */
    bot: BotType;

    /**
    * Owner of the bot we are displaying
    */
    owner?: UserProfile;

    /**
    * User of the bot we are displaying
    */
    user: UserProfile;

    /**
    * The access tokens of the bot user
    */
    accessTokens: Record<string, UserAccessToken>;

    /**
    * String used for filtering bot items
    */
    filter?: string;

    /**
     * Determine whether this bot is managed by the app framework
     */
    fromApp: boolean;

    actions: {

        /**
        * Disable a bot
        */
        disableBot: (userId: string) => Promise<ActionResult>;

        /**
        * Enable a bot
        */
        enableBot: (userId: string) => Promise<ActionResult>;

        /**
        * Access token managment
        */
        createUserAccessToken: (userId: string, description: string) => Promise<{
            data: {token: string; description: string; id: string; is_active: boolean} | null;
            error?: Error;
        }>;

        revokeUserAccessToken: (tokenId: string) => Promise<{data: string; error?: Error}>;
        enableUserAccessToken: (tokenId: string) => Promise<{data: string; error?: Error}>;
        disableUserAccessToken: (tokenId: string) => Promise<{data: string; error?: Error}>;
    };

    /**
    *  Only used for routing since backstage is team based.
    */
    team: Team;
}

type State = {
    confirmingId: string;
    creatingTokenState: string;
    token: UserAccessToken | Record<string, any>;
    error: ReactNode;
}

export default class Bot extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            confirmingId: '',
            creatingTokenState: 'CLOSED',
            token: {},
            error: '',
        };
    }

    enableBot = (): void => {
        this.props.actions.enableBot(this.props.bot.user_id);
    };

    disableBot = (): void => {
        this.props.actions.disableBot(this.props.bot.user_id);
    };

    enableUserAccessToken = (id: string): void => {
        this.props.actions.enableUserAccessToken(id);
    };

    disableUserAccessToken = (id: string): void => {
        this.props.actions.disableUserAccessToken(id);
    };

    confirmRevokeToken = (id: string): void => {
        this.setState({confirmingId: id});
    };

    revokeTokenConfirmed = (): void => {
        this.props.actions.revokeUserAccessToken(this.state.confirmingId);
        this.closeConfirm();
    };

    closeConfirm = (): void => {
        this.setState({confirmingId: ''});
    };

    openCreateToken = (): void => {
        this.setState({
            creatingTokenState: 'OPEN',
            token: {
                description: '',
            },
        });
    };

    closeCreateToken = (): void => {
        this.setState({
            creatingTokenState: 'CLOSED',
            token: {
                description: '',
            },
        });
    };

    handleUpdateDescription = (e: ChangeEvent<HTMLInputElement>): void => {
        const target = e.target as HTMLInputElement;
        this.setState({
            token: Object.assign({}, this.state.token, {description: target.value}),
        });
    };

    handleCreateToken = async (e: SyntheticEvent): Promise<void> => {
        e.preventDefault();

        if (this.state.token.description === '') {
            this.setState({error: (
                <FormattedMessage
                    id='bot.token.error.description'
                    defaultMessage='Please enter a description.'
                />
            )});
            return;
        }

        const {data, error} = await this.props.actions.createUserAccessToken(this.props.bot.user_id, this.state.token.description);
        if (data) {
            this.setState({creatingTokenState: 'CREATED', token: data});
        } else if (error) {
            this.setState({error: error.message});
        }
    };

    public render(): JSX.Element | null {
        const username = this.props.bot.username || '';
        const description = this.props.bot.description || '';
        const displayName = this.props.bot.display_name || '';

        let ownerUsername = 'plugin';
        if (this.props.fromApp) {
            ownerUsername = 'Apps Framework';
        } else if (this.props.owner && this.props.owner.username) {
            ownerUsername = this.props.owner.username;
        }
        const filter = this.props.filter ? this.props.filter.toLowerCase() : '';
        if (!matchesFilter(this.props.bot, filter, this.props.owner)) {
            return null;
        }

        const tokenList = [];
        Object.values(this.props.accessTokens).forEach((token) => {
            let activeLink;
            let disableClass = '';
            let disabledText;

            if (token.is_active) {
                activeLink = (
                    <a
                        id={token.id + '_deactivate'}
                        href='#'
                        onClick={(e) => {
                            e.preventDefault();
                            this.disableUserAccessToken(token.id);
                        }}
                    >
                        <FormattedMessage
                            id='user.settings.tokens.deactivate'
                            defaultMessage='Disable'
                        />
                    </a>);
            } else {
                disableClass = 'light';
                disabledText = (
                    <span className='mr-2 light'>
                        <FormattedMessage
                            id='user.settings.tokens.deactivatedWarning'
                            defaultMessage='(Disabled)'
                        />
                    </span>
                );
                activeLink = (
                    <a
                        id={token.id + '_activate'}
                        href='#'
                        onClick={(e) => {
                            e.preventDefault();
                            this.enableUserAccessToken(token.id);
                        }}
                    >
                        <FormattedMessage
                            id='user.settings.tokens.activate'
                            defaultMessage='Enable'
                        />
                    </a>
                );
            }

            tokenList.push(
                <div
                    key={token.id}
                    className='bot-list__item'
                >
                    <div className='item-details__row d-flex justify-content-between'>
                        <div className={disableClass}>
                            <div className='whitespace--nowrap overflow--ellipsis'>
                                <b>
                                    <FormattedMessage
                                        id='user.settings.tokens.tokenDesc'
                                        defaultMessage='Token Description: '
                                    />
                                </b>
                                {token.description}
                            </div>
                            <div className='setting-box__token-id whitespace--nowrap overflow--ellipsis'>
                                <b>
                                    <FormattedMessage
                                        id='user.settings.tokens.tokenId'
                                        defaultMessage='Token ID: '
                                    />
                                </b>
                                {token.id}
                            </div>
                        </div>
                        <div>
                            {disabledText}
                            {activeLink}
                            {' - '}
                            <a
                                id={token.id + '_delete'}
                                href='#'
                                onClick={(e) => {
                                    e.preventDefault();
                                    this.confirmRevokeToken(token.id);
                                }}
                            >
                                <FormattedMessage
                                    id='user.settings.tokens.delete'
                                    defaultMessage='Delete'
                                />
                            </a>
                        </div>
                    </div>
                </div>,
            );
        });

        let options;
        if (ownerUsername !== 'plugin') {
            options = (
                <div className='item-actions'>
                    <button
                        id='createToken'
                        className='style--none color--link'
                        onClick={this.openCreateToken}
                    >
                        <FormattedMessage
                            id='bot.manage.create_token'
                            defaultMessage='Create New Token'
                        />
                    </button>
                    {' - '}
                    <Link to={`/${this.props.team.name}/integrations/bots/edit?id=${this.props.bot.user_id}`}>
                        <FormattedMessage
                            id='bots.manage.edit'
                            defaultMessage='Edit'
                        />
                    </Link>
                    {' - '}
                    <button
                        className='style--none color--link'
                        onClick={this.disableBot}
                    >
                        <FormattedMessage
                            id='bot.manage.disable'
                            defaultMessage='Disable'
                        />
                    </button>
                </div>
            );
        }
        if (this.props.bot.delete_at !== 0) {
            options = (
                <div className='item-actions'>
                    <button
                        className='style--none color--link'
                        onClick={this.enableBot}
                    >
                        <FormattedMessage
                            id='bot.manage.enable'
                            defaultMessage='Enable'
                        />
                    </button>
                </div>
            );
        }

        if (this.state.creatingTokenState === 'OPEN') {
            tokenList.push(
                <div
                    key={'create'}
                    className='bot-list__item'
                >
                    <div key={'create'}>
                        <form
                            className='form-horizontal'
                            onSubmit={this.handleCreateToken}
                        >
                            <div className='row'>
                                <label className='col-sm-auto control-label'>
                                    <FormattedMessage
                                        id='user.settings.tokens.name'
                                        defaultMessage='Token Description: '
                                    />
                                </label>
                                <div className='col-sm-4'>
                                    <input
                                        autoFocus={true}
                                        className='form-control form-sm'
                                        type='text'
                                        maxLength={64}
                                        value={this.state.token.description}
                                        onChange={this.handleUpdateDescription}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className='pt-2 pb-2'>
                                    <FormattedMessage
                                        id='user.settings.tokens.nameHelp'
                                        defaultMessage='Enter a description for your token to remember what it does.'
                                    />
                                </div>
                                <label
                                    id='clientError'
                                    className='has-error is-empty'
                                >
                                    {this.state.error}
                                </label>
                                <div className='mt-2'>
                                    <SaveButton
                                        btnClass='btn-sm btn-primary'
                                        savingMessage={
                                            <FormattedMessage
                                                id='user.settings.tokens.save'
                                                defaultMessage='Save'
                                            />
                                        }
                                        saving={false}
                                    />
                                    <button
                                        className='btn btn-sm btn-link'
                                        onClick={this.closeCreateToken}
                                    >
                                        <FormattedMessage
                                            id='user.settings.tokens.cancel'
                                            defaultMessage='Cancel'
                                        />
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>,
            );
        } else if (this.state.creatingTokenState === 'CREATED') {
            tokenList.push(
                <div
                    key={'created'}
                    className='bot-list__item alert alert-warning'
                >
                    <div className='mb-2'>
                        <WarningIcon additionalClassName='mr-2'/>
                        <FormattedMessage
                            id='user.settings.tokens.copy'
                            defaultMessage="Please copy the access token below. You won't be able to see it again!"
                        />
                    </div>
                    <div className='whitespace--nowrap overflow--ellipsis'>
                        <FormattedMessage
                            id='user.settings.tokens.name'
                            defaultMessage='Token Description: '
                        />
                        {this.state.token.description}
                    </div>
                    <div className='whitespace--nowrap overflow--ellipsis'>
                        <FormattedMessage
                            id='user.settings.tokens.id'
                            defaultMessage='Token ID: '
                        />
                        {this.state.token.id}
                    </div>
                    <strong className='word-break--all'>
                        <FormattedMessage
                            id='user.settings.tokens.token'
                            defaultMessage='Access Token: '
                        />
                        {this.state.token.token}
                    </strong>
                    <div className='mt-2'>
                        <button
                            className='btn btn-sm btn-primary'
                            onClick={this.closeCreateToken}
                        >
                            <FormattedMessage
                                id='bot.create_token.close'
                                defaultMessage='Close'
                            />
                        </button>
                    </div>
                </div>,
            );
        }

        const imageURL = Utils.imageURLForUser(this.props.user.id, this.props.user.last_picture_update);

        return (
            <div className='backstage-list__item'>
                <div className={'bot-list-img-container'}>
                    <img
                        className={'bot-list-img'}
                        alt={'bot image'}
                        src={imageURL}
                    />
                </div>
                <div className='item-details'>
                    <div className='item-details__row d-flex flex-column flex-md-row justify-content-between'>
                        <strong className='item-details__name'>
                            {displayName + ' (@' + username + ')'}
                        </strong>
                        {options}
                    </div>
                    <div className='bot-details__description'>
                        <Markdown message={description}/>
                    </div>
                    <div className='light small'>
                        <FormattedMessage
                            id='bots.managed_by'
                            defaultMessage='Managed by '
                        />
                        {ownerUsername}
                    </div>
                    <div className='bot-list is-empty'>
                        {tokenList}
                    </div>
                </div>
                <ConfirmModal
                    title={
                        <FormattedMessage
                            id='bots.token.delete'
                            defaultMessage='Delete Token'
                        />
                    }
                    message={
                        <FormattedMessage
                            id='bots.token.confirm_text'
                            defaultMessage='Are you sure you want to delete the token?'
                        />
                    }
                    confirmButtonText={
                        <FormattedMessage
                            id='bots.token.confirm'
                            defaultMessage='Delete'
                        />
                    }
                    show={this.state.confirmingId !== ''}
                    onConfirm={this.revokeTokenConfirmed}
                    onCancel={this.closeConfirm}
                />
            </div>
        );
    }
}
