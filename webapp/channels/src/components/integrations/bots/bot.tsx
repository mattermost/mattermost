// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, SyntheticEvent, ReactNode} from 'react';
import {FormattedDate, FormattedMessage, FormattedTime} from 'react-intl';
import {Link} from 'react-router-dom';

import {Button} from '@mattermost/shared/components/button';
import type {Bot as BotType} from '@mattermost/types/bots';
import type {ServerError} from '@mattermost/types/errors';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile, UserAccessToken} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ConfirmModal from 'components/confirm_modal';
import CopyText from 'components/copy_text';
import Markdown from 'components/markdown';
import SaveButton from 'components/save_button';
import type {ExpiryPreset} from 'components/user_settings/security/user_access_token_section/user_access_token_section';
import {
    clampExpiresAtToMaxLifetime,
    defaultCustomExpiryDate,
    defaultExpiryPreset,
    deriveTokenStatus,
    getExpiryValidationError,
    isoPlusDays,
    isExpiryPresetAllowed,
    mapServerErrorIdToMessage,
    resolveTokenExpiresAt,
    todayIso,
} from 'components/user_settings/security/user_access_token_section/user_access_token_section';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

import * as Utils from 'utils/utils';

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

const APPROACHING_EXPIRY_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

    pluginDisplayName?: string;

    maxLifetimeDays: number;

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
        createUserAccessToken: (userId: string, description: string, expiresAt?: number) => Promise<ActionResult<UserAccessToken>>;

        revokeUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        enableUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        disableUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        rotateUserAccessToken: (tokenId: string, expiresAt?: number) => Promise<ActionResult<UserAccessToken>>;
    };

    /**
    *  Only used for routing since backstage is team based.
    */
    team: Team;
};

type State = {
    confirmingId: string;
    creatingTokenState: string;
    token: UserAccessToken | Record<string, any>;
    error: ReactNode;
    serverError: ReactNode;
    expiryPreset: ExpiryPreset;
    customExpiryDate: string;
    regeneratingTokenId: string;
    regenerateExpiryPreset: ExpiryPreset;
    regenerateCustomExpiryDate: string;
    saving: boolean;
};

export default class Bot extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            confirmingId: '',
            creatingTokenState: 'CLOSED',
            token: {},
            error: '',
            serverError: '',
            expiryPreset: this.defaultExpiryPreset(),
            customExpiryDate: this.defaultCustomExpiryDate(),
            regeneratingTokenId: '',
            regenerateExpiryPreset: this.defaultExpiryPreset(),
            regenerateCustomExpiryDate: this.defaultCustomExpiryDate(),
            saving: false,
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

    isUserOwnedBot = (): boolean => {
        return Boolean(this.props.owner?.username) && !this.props.fromApp;
    };

    isExpiryEnforced = (): boolean => {
        return this.isUserOwnedBot() && this.props.maxLifetimeDays > 0;
    };

    defaultCustomExpiryDate = (): string => {
        return defaultCustomExpiryDate(this.props.maxLifetimeDays);
    };

    isPresetAllowed = (preset: ExpiryPreset): boolean => {
        return isExpiryPresetAllowed(preset, this.props.maxLifetimeDays);
    };

    defaultExpiryPreset = (): ExpiryPreset => {
        return defaultExpiryPreset(this.props.maxLifetimeDays, this.isExpiryEnforced());
    };

    resolveExpiresAt = (expiryPreset: ExpiryPreset = this.state.expiryPreset, customExpiryDate: string = this.state.customExpiryDate): number => {
        return resolveTokenExpiresAt(expiryPreset, customExpiryDate, this.isUserOwnedBot());
    };

    getExpiryValidationError = (expiryPreset: ExpiryPreset = this.state.expiryPreset, customExpiryDate: string = this.state.customExpiryDate): ReactNode | null => {
        return getExpiryValidationError(expiryPreset, customExpiryDate, this.props.maxLifetimeDays, this.isExpiryEnforced(), this.isUserOwnedBot());
    };

    handleExpiryPresetChange = (e: ChangeEvent<HTMLSelectElement>): void => {
        this.setState({expiryPreset: e.target.value as ExpiryPreset, error: ''});
    };

    handleCustomExpiryChange = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({customExpiryDate: e.target.value, error: ''});
    };

    handleRegenerateExpiryPresetChange = (e: ChangeEvent<HTMLSelectElement>): void => {
        this.setState({regenerateExpiryPreset: e.target.value as ExpiryPreset});
    };

    handleRegenerateCustomExpiryChange = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({regenerateCustomExpiryDate: e.target.value});
    };

    openCreateToken = (): void => {
        this.setState({
            creatingTokenState: 'OPEN',
            token: {
                description: '',
            },
            error: '',
            serverError: '',
            expiryPreset: this.defaultExpiryPreset(),
            customExpiryDate: this.defaultCustomExpiryDate(),
        });
    };

    closeCreateToken = (): void => {
        this.setState({
            creatingTokenState: 'CLOSED',
            token: {
                description: '',
            },
            error: '',
            saving: false,
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

        const description = this.state.token.description?.trim() || '';
        if (description === '') {
            this.setState({error: (
                <FormattedMessage
                    id='bot.token.error.description'
                    defaultMessage='Please enter a description.'
                />
            )});
            return;
        }

        const expiryError = this.getExpiryValidationError();
        if (expiryError) {
            this.setState({error: expiryError});
            return;
        }

        const expiresAt = this.resolveExpiresAt();
        const clampedExpiresAt = clampExpiresAtToMaxLifetime(expiresAt, this.props.maxLifetimeDays);

        this.setState({saving: true, error: '', serverError: ''});
        const {data, error} = await this.props.actions.createUserAccessToken(this.props.bot.user_id, description, clampedExpiresAt > 0 ? clampedExpiresAt : undefined);
        if (data) {
            this.setState({creatingTokenState: 'CREATED', token: data, saving: false});
        } else if (error) {
            const serverError = error as ServerError;
            const mapped = mapServerErrorIdToMessage(serverError.server_error_id, this.props.maxLifetimeDays);
            this.setState({error: mapped || serverError.message, saving: false});
        }
    };

    openRegenerateToken = (id: string): void => {
        const regenerateExpiryPreset = this.defaultExpiryPreset();
        const regenerateCustomExpiryDate = this.defaultCustomExpiryDate();
        this.setState({
            regeneratingTokenId: id,
            regenerateExpiryPreset,
            regenerateCustomExpiryDate,
            serverError: '',
        });
    };

    closeRegenerateToken = (): void => {
        this.setState({
            regeneratingTokenId: '',
            saving: false,
        });
    };

    regenerateTokenConfirmed = async (): Promise<void> => {
        const expiryError = this.getExpiryValidationError(this.state.regenerateExpiryPreset, this.state.regenerateCustomExpiryDate);
        if (expiryError) {
            this.setState({serverError: expiryError});
            return;
        }

        const expiresAt = this.resolveExpiresAt(this.state.regenerateExpiryPreset, this.state.regenerateCustomExpiryDate);
        const clampedExpiresAt = clampExpiresAtToMaxLifetime(expiresAt, this.props.maxLifetimeDays);

        this.setState({saving: true, serverError: ''});
        const {data, error} = await this.props.actions.rotateUserAccessToken(this.state.regeneratingTokenId, clampedExpiresAt > 0 ? clampedExpiresAt : undefined);

        if (data) {
            this.setState({creatingTokenState: 'CREATED', token: data, regeneratingTokenId: '', saving: false});
        } else if (error) {
            const serverError = error as ServerError;
            const mapped = mapServerErrorIdToMessage(serverError.server_error_id, this.props.maxLifetimeDays);
            this.setState({serverError: mapped || serverError.message, regeneratingTokenId: '', saving: false});
        }
    };

    renderExpiryPicker = (
        idPrefix: string,
        expiryPreset: ExpiryPreset,
        customExpiryDate: string,
        onPresetChange: (e: ChangeEvent<HTMLSelectElement>) => void,
        onCustomDateChange: (e: ChangeEvent<HTMLInputElement>) => void,
    ): JSX.Element | null => {
        if (!this.isUserOwnedBot()) {
            return null;
        }

        const enforceExpiry = this.isExpiryEnforced();
        const maxCustomIso = this.props.maxLifetimeDays > 0 ? isoPlusDays(this.props.maxLifetimeDays) : undefined;

        return (
            <div className='row pt-2'>
                <label
                    className='col-sm-auto control-label pr-3'
                    htmlFor={`${idPrefix}Expiry`}
                >
                    <FormattedMessage
                        id='user.settings.tokens.expiry'
                        defaultMessage='Expires: '
                    />
                </label>
                <div className='col-sm-auto'>
                    <select
                        id={`${idPrefix}Expiry`}
                        className='form-control form-sm'
                        value={expiryPreset}
                        onChange={onPresetChange}
                    >
                        {!enforceExpiry && (
                            <option value='none'>
                                <FormattedMessage
                                    id='user.settings.tokens.expiry.none'
                                    defaultMessage='No expiry'
                                />
                            </option>
                        )}
                        {this.isPresetAllowed('7d') && (
                            <option value='7d'>
                                <FormattedMessage
                                    id='user.settings.tokens.expiry.7d'
                                    defaultMessage='7 days'
                                />
                            </option>
                        )}
                        {this.isPresetAllowed('30d') && (
                            <option value='30d'>
                                <FormattedMessage
                                    id='user.settings.tokens.expiry.30d'
                                    defaultMessage='30 days'
                                />
                            </option>
                        )}
                        {this.isPresetAllowed('90d') && (
                            <option value='90d'>
                                <FormattedMessage
                                    id='user.settings.tokens.expiry.90d'
                                    defaultMessage='90 days'
                                />
                            </option>
                        )}
                        {this.isPresetAllowed('1y') && (
                            <option value='1y'>
                                <FormattedMessage
                                    id='user.settings.tokens.expiry.1y'
                                    defaultMessage='1 year'
                                />
                            </option>
                        )}
                        <option value='custom'>
                            <FormattedMessage
                                id='user.settings.tokens.expiry.custom'
                                defaultMessage='Custom date…'
                            />
                        </option>
                    </select>
                    {expiryPreset === 'custom' && (
                        <input
                            id={`${idPrefix}ExpiryCustom`}
                            className='form-control form-sm mt-2'
                            type='date'
                            aria-label={Utils.localizeMessage({id: 'user.settings.tokens.expiry.customDate', defaultMessage: 'Custom expiry date'})}
                            value={customExpiryDate}
                            min={todayIso()}
                            max={maxCustomIso}
                            onChange={onCustomDateChange}
                        />
                    )}
                    {this.props.maxLifetimeDays > 0 && (
                        <div className='pt-2'>
                            <FormattedMessage
                                id='user.settings.tokens.maxLifetimeHint'
                                defaultMessage='Tokens can be valid for up to {days, number} {days, plural, one {day} other {days}}.'
                                values={{days: this.props.maxLifetimeDays}}
                            />
                        </div>
                    )}
                    {enforceExpiry && (
                        <div className='pt-2'>
                            <FormattedMessage
                                id='user.settings.tokens.expiryEnforced'
                                defaultMessage='Your administrator requires all personal access tokens to have an expiry date.'
                            />
                        </div>
                    )}
                </div>
            </div>
        );
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

        const isUserOwnedBot = this.isUserOwnedBot();
        const tokenList = [];
        Object.values(this.props.accessTokens).forEach((token) => {
            let activeLink;
            let disableClass = '';
            let disabledText;
            let statusBadge;
            let expiryRow;

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
                if (!isUserOwnedBot) {
                    disableClass = 'light';
                    disabledText = (
                        <span className='mr-2 light'>
                            <FormattedMessage
                                id='user.settings.tokens.deactivatedWarning'
                                defaultMessage='(Disabled)'
                            />
                        </span>
                    );
                }
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

            if (isUserOwnedBot) {
                const status = deriveTokenStatus(token);
                statusBadge = (
                    <span className={`bot-token__status bot-token__status--${status}`}>
                        {status === 'active' && (
                            <FormattedMessage
                                id='user.settings.tokens.status.active'
                                defaultMessage='Active'
                            />
                        )}
                        {status === 'expired' && (
                            <FormattedMessage
                                id='user.settings.tokens.status.expired'
                                defaultMessage='Expired'
                            />
                        )}
                        {status === 'inactive' && (
                            <FormattedMessage
                                id='user.settings.tokens.status.inactive'
                                defaultMessage='Disabled'
                            />
                        )}
                    </span>
                );

                const hasExpiry = Boolean(token.expires_at && token.expires_at > 0);
                const msUntilExpiry = hasExpiry ? (token.expires_at as number) - Date.now() : Infinity;
                const approachingExpiry = status === 'active' && hasExpiry && msUntilExpiry > 0 && msUntilExpiry < APPROACHING_EXPIRY_DAYS * MS_PER_DAY;
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                const daysUntilExpiry = hasExpiry ? Math.max(0, Math.floor(((token.expires_at as number) - startOfToday.getTime()) / MS_PER_DAY)) : 0;

                expiryRow = (
                    <div className='bot-token__expiry whitespace--nowrap overflow--ellipsis'>
                        <b>
                            <FormattedMessage
                                id='user.settings.tokens.expiry'
                                defaultMessage='Expires: '
                            />
                        </b>
                        {hasExpiry ? (
                            <>
                                <FormattedDate
                                    value={token.expires_at}
                                    year='numeric'
                                    month='short'
                                    day='2-digit'
                                />
                                {' '}
                                <FormattedTime value={token.expires_at}/>
                                {approachingExpiry && (
                                    <span className='bot-token__expiry-warning'>
                                        {' '}
                                        <WarningIcon/>
                                        {' '}
                                        <FormattedMessage
                                            id='user.settings.tokens.expiresSoon'
                                            defaultMessage='Expires in {days, number} {days, plural, one {day} other {days}}'
                                            values={{days: daysUntilExpiry}}
                                        />
                                    </span>
                                )}
                            </>
                        ) : (
                            <FormattedMessage
                                id='user.settings.tokens.expiry.never'
                                defaultMessage='Never'
                            />
                        )}
                    </div>
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
                                {' '}
                                {statusBadge}
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
                            {expiryRow}
                        </div>
                        <div>
                            {disabledText}
                            {activeLink}
                            {isUserOwnedBot && token.is_active && (
                                <>
                                    {' - '}
                                    <a
                                        id={token.id + '_regenerate'}
                                        href='#'
                                        onClick={(e) => {
                                            e.preventDefault();
                                            this.openRegenerateToken(token.id);
                                        }}
                                    >
                                        <FormattedMessage
                                            id='user.settings.tokens.regenerate'
                                            defaultMessage='Regenerate'
                                        />
                                    </a>
                                </>
                            )}
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
            const expiryError = this.getExpiryValidationError();
            const descriptionEmpty = !this.state.token.description || this.state.token.description.trim() === '';
            const expirySection = this.renderExpiryPicker('botToken', this.state.expiryPreset, this.state.customExpiryDate, this.handleExpiryPresetChange, this.handleCustomExpiryChange);

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
                                <label
                                    className='col-sm-auto control-label'
                                    htmlFor='botToken'
                                >
                                    <FormattedMessage
                                        id='user.settings.tokens.name'
                                        defaultMessage='Token Description: '
                                    />
                                </label>
                                <div className='col-sm-4'>
                                    <input
                                        id='botToken'
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
                                {expirySection}
                                <label
                                    id='clientError'
                                    className='has-error is-empty'
                                >
                                    {this.state.error || expiryError}
                                </label>
                                <div className='mt-2'>
                                    <SaveButton
                                        emphasis='primary'
                                        size='sm'
                                        savingMessage={
                                            <FormattedMessage
                                                id='user.settings.tokens.save'
                                                defaultMessage='Save'
                                            />
                                        }
                                        saving={this.state.saving}
                                        disabled={descriptionEmpty || Boolean(expiryError)}
                                    />
                                    <Button
                                        emphasis='tertiary'
                                        size='sm'
                                        onClick={this.closeCreateToken}
                                    >
                                        <FormattedMessage
                                            id='user.settings.tokens.cancel'
                                            defaultMessage='Cancel'
                                        />
                                    </Button>
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
                    <CopyText
                        label={{id: 'integrations.copy_token', defaultMessage: 'Copy Token'}}
                        value={this.state.token.token}
                    />
                    <div className='mt-2'>
                        <Button
                            emphasis='primary'
                            size='sm'
                            onClick={this.closeCreateToken}
                        >
                            <FormattedMessage
                                id='bot.create_token.close'
                                defaultMessage='Close'
                            />
                        </Button>
                    </div>
                </div>,
            );
        }

        let managedBy;
        if (this.props.fromApp) {
            managedBy = (
                <FormattedMessage
                    id='bots.managed_by.app'
                    defaultMessage='Managed by Apps Framework'
                />
            );
        } else if (this.props.owner && this.props.owner.username) {
            managedBy = (
                <FormattedMessage
                    id='bots.managed_by.user'
                    defaultMessage='Managed by {owner}'
                    values={{owner: this.props.owner.username}}
                />
            );
        } else if (this.props.bot.owner_id) {
            managedBy = this.props.pluginDisplayName && this.props.pluginDisplayName !== this.props.bot.owner_id ? (
                <FormattedMessage
                    id='bots.managed_by.plugin_named'
                    defaultMessage='Managed by {pluginName} plugin'
                    values={{pluginName: this.props.pluginDisplayName}}
                />
            ) : (
                <FormattedMessage
                    id='bots.managed_by.plugin'
                    defaultMessage='Managed by plugin {pluginId}'
                    values={{pluginId: this.props.bot.owner_id}}
                />
            );
        } else {
            managedBy = (
                <FormattedMessage
                    id='bots.managed_by.unknown_plugin'
                    defaultMessage='Managed by a plugin'
                />
            );
        }

        const regenerateToken = this.props.accessTokens[this.state.regeneratingTokenId];
        const regenerateExpiryError = this.getExpiryValidationError(this.state.regenerateExpiryPreset, this.state.regenerateCustomExpiryDate);
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
                        {managedBy}
                    </div>
                    {this.state.serverError && (
                        <div className='has-error mt-2'>
                            {this.state.serverError}
                        </div>
                    )}
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
                    modalClass='integrations-backstage-modal'
                    show={this.state.confirmingId !== ''}
                    onConfirm={this.revokeTokenConfirmed}
                    onCancel={this.closeConfirm}
                />
                <ConfirmModal
                    title={
                        <FormattedMessage
                            id='user.settings.tokens.confirmRegenerateTitle'
                            defaultMessage='Regenerate Token?'
                        />
                    }
                    message={regenerateToken ? (
                        <div>
                            <div className='alert alert-danger'>
                                <FormattedMessage
                                    id='user.settings.tokens.confirmRegenerate.description'
                                    defaultMessage='The current secret for this token will stop working immediately. Any integrations using it will need to be updated with the new secret. You cannot undo this action.'
                                />
                            </div>
                            {this.renderExpiryPicker('regenerateBotToken', this.state.regenerateExpiryPreset, this.state.regenerateCustomExpiryDate, this.handleRegenerateExpiryPresetChange, this.handleRegenerateCustomExpiryChange)}
                            {regenerateExpiryError && (
                                <div className='has-error mt-2'>
                                    {regenerateExpiryError}
                                </div>
                            )}
                            <p className='pt-3'>
                                <FormattedMessage
                                    id='user.settings.tokens.confirmRegenerate.confirmation'
                                    defaultMessage='Are you sure you want to regenerate the <b>{description}</b> token?'
                                    values={{
                                        description: regenerateToken.description,
                                        b: (chunks) => <b>{chunks}</b>,
                                    }}
                                />
                            </p>
                        </div>
                    ) : null}
                    confirmButtonText={
                        <FormattedMessage
                            id='user.settings.tokens.confirmRegenerateButton'
                            defaultMessage='Yes, Regenerate'
                        />
                    }
                    modalClass='integrations-backstage-modal'
                    show={this.state.regeneratingTokenId !== ''}
                    onConfirm={this.regenerateTokenConfirmed}
                    onCancel={this.closeRegenerateToken}
                    confirmDisabled={Boolean(regenerateExpiryError) || this.state.saving}
                />
            </div>
        );
    }
}
