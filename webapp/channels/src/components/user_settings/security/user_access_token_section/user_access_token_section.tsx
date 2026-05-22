// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import type {Moment} from 'moment-timezone';
import React from 'react';
import {FormattedDate, FormattedMessage, FormattedTime, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import {isMobile} from '@mattermost/shared/utils/user_agent';
import type {ServerError} from '@mattermost/types/errors';
import type {UserAccessToken, UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import ConfirmModal from 'components/confirm_modal';
import DateTimePickerModal from 'components/date_time_picker_modal/date_time_picker_modal';
import ExternalLink from 'components/external_link';
import SaveButton from 'components/save_button';
import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

import {Constants, DeveloperLinks} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

const SECTION_TOKENS = 'tokens';
const TOKEN_CREATING = 'creating';
const TOKEN_CREATED = 'created';
const TOKEN_NOT_CREATING = 'not_creating';

const APPROACHING_EXPIRY_DAYS = 7;
const DEFAULT_EXPIRY_DAYS = 30;

type TokenStatus = 'active' | 'expired' | 'inactive';

function deriveTokenStatus(token: {is_active: boolean; expires_at?: number}): TokenStatus {
    if (!token.is_active) {
        return 'inactive';
    }
    if (token.expires_at && token.expires_at > 0 && token.expires_at < Date.now()) {
        return 'expired';
    }
    return 'active';
}

function mapServerErrorIdToMessage(errorId?: string, maxDays?: number): React.ReactNode | null {
    switch (errorId) {
    case 'api.user.create_user_access_token.expires_at_required.app_error':
    case 'expires_at_required':
        return (
            <FormattedMessage
                id='user.settings.tokens.expiryRequired'
                defaultMessage='An expiry date is required.'
            />
        );
    case 'api.user.create_user_access_token.expires_at_in_past.app_error':
    case 'expires_at_in_past':
        return (
            <FormattedMessage
                id='user.settings.tokens.expiryInPast'
                defaultMessage='Expiry must be in the future.'
            />
        );
    case 'api.user.create_user_access_token.expires_at_too_far.app_error':
    case 'expires_at_too_far':
        return (
            <FormattedMessage
                id='user.settings.tokens.expiryTooFar'
                defaultMessage='Expiry can be at most {days, number} {days, plural, one {day} other {days}} from now.'
                values={{days: maxDays ?? 0}}
            />
        );
    default:
        return null;
    }
}

type OwnProps = {
    user: UserProfile;
    active?: boolean;
    areAllSectionsInactive: boolean;
    updateSection: (section: string) => void;
    userAccessTokens: {[tokenId: string]: {description: string; id: string; is_active: boolean; expires_at?: number}};
    enforceExpiry: boolean;
    maxLifetimeDays: number;
    setRequireConfirm: (isRequiredConfirm: boolean, confirmCopyToken: (confirmAction: () => void) => void) => void;
    actions: {
        getUserAccessTokensForUser: (userId: string, page: number, perPage: number) => void;
        createUserAccessToken: (userId: string, description: string, expiresAt?: number) => Promise<ActionResult<UserAccessToken>>;
        revokeUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        enableUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        disableUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        clearUserAccessTokens: () => void;
    };
}

type Props = OwnProps & WrappedComponentProps;

type State = {
    active?: boolean;
    showConfirmModal: boolean;
    newToken?: UserAccessToken | null;
    tokenCreationState?: string;
    tokenError?: React.ReactNode;
    serverError?: string|null;
    saving?: boolean;
    confirmTitle?: React.ReactNode;
    confirmMessage?: ((state: State) => JSX.Element)|null;
    confirmButton?: React.ReactNode;
    confirmComplete?: (() => void)|null;
    confirmHideCancel?: boolean;
    expiresAt: number;
    showExpiryPicker: boolean;
}

class UserAccessTokenSection extends React.PureComponent<Props, State> {
    private minRef: React.RefObject<SettingItemMinComponent>;
    private newtokendescriptionRef: React.RefObject<HTMLInputElement>;

    constructor(props: Props) {
        super(props);

        this.state = {
            active: this.props.active,
            showConfirmModal: false,
            newToken: null,
            tokenCreationState: TOKEN_NOT_CREATING,
            tokenError: '',
            serverError: null,
            saving: false,
            expiresAt: 0,
            showExpiryPicker: false,
        };
        this.newtokendescriptionRef = React.createRef();
        this.minRef = React.createRef();
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.active && !this.props.active && this.props.areAllSectionsInactive) {
            this.focusEditButton();
        }
    }

    componentDidMount() {
        this.props.actions.clearUserAccessTokens();
        const userId = this.props.user ? this.props.user.id : '';
        this.props.actions.getUserAccessTokensForUser(userId, 0, 200);
    }

    static getDerivedStateFromProps(nextProps: Props, prevState: State) {
        if (!nextProps.active && prevState.active) {
            return {
                active: nextProps.active,
                showConfirmModal: false,
                newToken: null,
                tokenCreationState: TOKEN_NOT_CREATING,
                tokenError: '',
                serverError: null,
                saving: false,
                expiresAt: 0,
                showExpiryPicker: false,
            };
        }
        return {active: nextProps.active};
    }

    focusEditButton(): void {
        this.minRef.current?.focus();
    }

    startCreatingToken = () => {
        const {maxLifetimeDays} = this.props;
        const defaultDays = maxLifetimeDays > 0 ? Math.min(DEFAULT_EXPIRY_DAYS, maxLifetimeDays) : DEFAULT_EXPIRY_DAYS;
        const defaultExpiry = this.props.enforceExpiry ? moment().add(defaultDays, 'days').valueOf() : 0;
        this.setState({
            tokenCreationState: TOKEN_CREATING,
            expiresAt: defaultExpiry,
            showExpiryPicker: false,
            tokenError: '',
        });
    };

    stopCreatingToken = () => {
        this.setState({
            tokenCreationState: TOKEN_NOT_CREATING,
            saving: false,
            expiresAt: 0,
            showExpiryPicker: false,
            tokenError: '',
        });
    };

    openExpiryPicker = () => {
        this.setState({showExpiryPicker: true});
    };

    closeExpiryPicker = () => {
        this.setState({showExpiryPicker: false});
    };

    handleExpiryConfirm = (dateTime: Moment) => {
        this.setState({expiresAt: dateTime.valueOf(), showExpiryPicker: false, tokenError: ''});
    };

    clearExpiry = () => {
        this.setState({expiresAt: 0});
    };

    handleCreateToken = async () => {
        this.handleCancelConfirm();

        const description = this.newtokendescriptionRef ? this.newtokendescriptionRef.current!.value : '';

        if (description === '') {
            this.setState({
                tokenError: (
                    <FormattedMessage
                        id='user.settings.tokens.nameRequired'
                        defaultMessage='Please enter a description.'
                    />
                ),
            });
            return;
        }

        const {enforceExpiry, maxLifetimeDays} = this.props;
        const {expiresAt} = this.state;

        if (enforceExpiry && expiresAt <= 0) {
            this.setState({
                tokenError: mapServerErrorIdToMessage('expires_at_required'),
            });
            return;
        }
        if (expiresAt > 0 && expiresAt <= Date.now()) {
            this.setState({
                tokenError: mapServerErrorIdToMessage('expires_at_in_past'),
            });
            return;
        }
        if (expiresAt > 0 && maxLifetimeDays > 0) {
            const maxAllowed = moment().add(maxLifetimeDays, 'days').valueOf();
            if (expiresAt > maxAllowed) {
                this.setState({
                    tokenError: mapServerErrorIdToMessage('expires_at_too_far', maxLifetimeDays),
                });
                return;
            }
        }

        this.setState({tokenError: '', saving: true});
        this.props.setRequireConfirm(true, this.confirmCopyToken);

        const userId = this.props.user ? this.props.user.id : '';
        const {data, error} = await this.props.actions.createUserAccessToken(userId, description, expiresAt || undefined);

        if (data && this.state.tokenCreationState === TOKEN_CREATING) {
            this.setState({tokenCreationState: TOKEN_CREATED, newToken: data, saving: false});
        } else if (error) {
            const serverError = error as ServerError;
            const mapped = mapServerErrorIdToMessage(serverError.server_error_id, maxLifetimeDays);
            if (mapped) {
                this.setState({tokenError: mapped, serverError: null, saving: false});
            } else {
                this.setState({serverError: serverError.message, saving: false});
            }
        }
    };

    confirmCopyToken = (confirmAction: () => void) => {
        this.setState({
            showConfirmModal: true,
            confirmTitle: (
                <FormattedMessage
                    id='user.settings.tokens.confirmCopyTitle'
                    defaultMessage='Copied Your Token?'
                />
            ),
            confirmMessage: (state: State) => (
                <div>
                    <FormattedMessage
                        id='user.settings.tokens.confirmCopyMessage'
                        defaultMessage="Make sure you have copied and saved the access token below. You won't be able to see it again!"
                    />
                    <br/>
                    <br/>
                    {state.tokenCreationState === TOKEN_CREATING ? (
                        <div>
                            <strong className='word-break--all'>
                                <FormattedMessage
                                    id='user.settings.tokens.token'
                                    defaultMessage='Access Token: '
                                />
                            </strong>
                            <FormattedMessage
                                id='user.settings.tokens.tokenLoading'
                                defaultMessage='Loading...'
                            />
                        </div>
                    ) : (
                        <strong className='word-break--all'>
                            <FormattedMessage
                                id='user.settings.tokens.token'
                                defaultMessage='Access Token: '
                            />
                            {state.newToken!.token}
                        </strong>
                    )}
                </div>
            ),
            confirmButton: (
                <FormattedMessage
                    id='user.settings.tokens.confirmCopyButton'
                    defaultMessage='Yes, I have copied the token'
                />
            ),
            confirmComplete: () => {
                this.handleCancelConfirm();
                confirmAction();
            },
            confirmHideCancel: true,
        });
    };

    handleCancelConfirm = () => {
        this.setState({
            showConfirmModal: false,
            confirmTitle: null,
            confirmMessage: null,
            confirmButton: null,
            confirmComplete: null,
            confirmHideCancel: false,
        });
    };

    confirmCreateToken = () => {
        if (!UserUtils.isSystemAdmin(this.props.user!.roles)) {
            this.handleCreateToken();
            return;
        }

        this.setState({
            showConfirmModal: true,
            confirmTitle: (
                <FormattedMessage
                    id='user.settings.tokens.confirmCreateTitle'
                    defaultMessage='Create System Admin Personal Access Token'
                />
            ),
            confirmMessage: () => (
                <div className='alert alert-danger'>
                    <FormattedMessage
                        id='user.settings.tokens.confirmCreateMessage'
                        defaultMessage='You are generating a personal access token with System Admin permissions. Are you sure want to create this token?'
                    />
                </div>
            ),
            confirmButton: (
                <FormattedMessage
                    id='user.settings.tokens.confirmCreateButton'
                    defaultMessage='Yes, Create'
                />
            ),
            confirmComplete: () => {
                this.handleCreateToken();
            },
        });
    };

    saveTokenKeyPress = (e: React.KeyboardEvent) => {
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER)) {
            this.confirmCreateToken();
        }
    };

    confirmRevokeToken = (tokenId: string) => {
        const token = this.props.userAccessTokens[tokenId];

        this.setState({
            showConfirmModal: true,
            confirmTitle: (
                <FormattedMessage
                    id='user.settings.tokens.confirmDeleteTitle'
                    defaultMessage='Delete Token?'
                />
            ),
            confirmMessage: () => (
                <div className='alert alert-danger'>
                    <p>
                        <FormattedMessage
                            id='user.settings.tokens.confirmDelete.description'
                            defaultMessage={'Any integrations using this token will no longer be able to access the Mattermost API. You cannot undo this action.'}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='user.settings.tokens.confirmDelete.confirmation'
                            defaultMessage={'Are you sure you want to delete the <b>{description}</b> token?'}
                            values={{
                                description: token.description,
                                b: (chunks) => <b>{chunks}</b>,
                            }}
                        />
                    </p>
                </div>
            ),
            confirmButton: (
                <FormattedMessage
                    id='user.settings.tokens.confirmDeleteButton'
                    defaultMessage='Yes, Delete'
                />
            ),
            confirmComplete: () => {
                this.revokeToken(tokenId);
            },
        });
    };

    revokeToken = async (tokenId: string) => {
        const {error} = await this.props.actions.revokeUserAccessToken(tokenId);
        if (error) {
            this.setState({serverError: error.message});
        }
        this.handleCancelConfirm();
    };

    activateToken = async (tokenId: string) => {
        const {error} = await this.props.actions.enableUserAccessToken(tokenId);
        if (error) {
            this.setState({serverError: error.message});
        }
    };

    deactivateToken = async (tokenId: string) => {
        const {error} = await this.props.actions.disableUserAccessToken(tokenId);
        if (error) {
            this.setState({serverError: error.message});
        }
    };

    render() {
        let tokenListClass = '';

        if (!this.props.active) {
            const describe = (
                <FormattedMessage
                    id='user.settings.tokens.clickToEdit'
                    defaultMessage="Click 'Edit' to manage your personal access tokens"
                />
            );

            return (
                <SettingItemMin
                    title={
                        <FormattedMessage
                            id='user.settings.tokens.title'
                            defaultMessage='Personal Access Tokens'
                        />
                    }
                    describe={describe}
                    section={SECTION_TOKENS}
                    updateSection={this.props.updateSection}
                    ref={this.minRef}
                />
            );
        }

        const tokenList: JSX.Element[] = [];
        Object.values(this.props.userAccessTokens).forEach((token) => {
            if (this.state.newToken && this.state.newToken.id === token.id) {
                return;
            }

            let activeLink: JSX.Element;
            const status = deriveTokenStatus(token);
            const statusBadgeClass = `setting-box__token-status setting-box__token-status--${status}`;
            const statusBadge = (
                <span className={statusBadgeClass}>
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

            if (token.is_active) {
                activeLink = (
                    <a
                        id={token.id + '_deactivate'}
                        href='#'
                        onClick={(e) => {
                            e.preventDefault();
                            this.deactivateToken(token.id);
                        }}
                    >
                        <FormattedMessage
                            id='user.settings.tokens.deactivate'
                            defaultMessage='Disable'
                        />
                    </a>);
            } else {
                activeLink = (
                    <a
                        id={token.id + '_activate'}
                        href='#'
                        onClick={(e) => {
                            e.preventDefault();
                            this.activateToken(token.id);
                        }}
                    >
                        <FormattedMessage
                            id='user.settings.tokens.activate'
                            defaultMessage='Enable'
                        />
                    </a>
                );
            }

            const hasExpiry = Boolean(token.expires_at && token.expires_at > 0);
            const msUntilExpiry = hasExpiry ? (token.expires_at as number) - Date.now() : Infinity;
            const approachingExpiry = status === 'active' && hasExpiry && msUntilExpiry > 0 && msUntilExpiry < APPROACHING_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
            const daysUntilExpiry = Math.max(0, Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000)));
            const expiresSoonLabel = approachingExpiry ? this.props.intl.formatMessage(
                {
                    id: 'user.settings.tokens.expiresSoon',
                    defaultMessage: 'Expires in {days, number} {days, plural, one {day} other {days}}',
                },
                {days: daysUntilExpiry},
            ) : undefined;

            const expiryRow = (
                <div className='setting-box__token-expiry whitespace--nowrap overflow--ellipsis'>
                    <FormattedMessage
                        id='user.settings.tokens.expiry'
                        defaultMessage='Expires: '
                    />
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
                                <span
                                    className='setting-box__token-expiry-warning'
                                    title={expiresSoonLabel}
                                >
                                    {' '}
                                    <WarningIcon/>
                                    {' '}
                                    {expiresSoonLabel}
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

            tokenList.push(
                <div
                    key={token.id}
                    className='setting-box__item'
                >
                    <div className='whitespace--nowrap overflow--ellipsis'>
                        <FormattedMessage
                            id='user.settings.tokens.tokenDesc'
                            defaultMessage='Token Description: '
                        />
                        {token.description}
                        {' '}
                        {statusBadge}
                    </div>
                    <div className='setting-box__token-id whitespace--nowrap overflow--ellipsis'>
                        <FormattedMessage
                            id='user.settings.tokens.tokenId'
                            defaultMessage='Token ID: '
                        />
                        {token.id}
                    </div>
                    {expiryRow}
                    <div>
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
                    <hr className='mb-3 mt-3'/>
                </div>,
            );
        });

        let noTokenText;
        if (tokenList.length === 0) {
            noTokenText = (
                <FormattedMessage
                    key='notokens'
                    id='user.settings.tokens.userAccessTokensNone'
                    defaultMessage='No personal access tokens.'
                />
            );
        }

        let extraInfo;
        if (isMobile()) {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.tokens.description_mobile'
                        defaultMessage='<linkTokens>Personal access tokens</linkTokens> function similarly to session tokens and can be used by integrations to <linkAPI>authenticate against the REST API</linkAPI>. Create new tokens on your desktop.'
                        values={{
                            linkTokens: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href={DeveloperLinks.PERSONAL_ACCESS_TOKENS}
                                    location='user_access_token_section'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            linkAPI: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href='https://api.mattermost.com/#tag/authentication'
                                    location='user_access_token_section'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />
                </span>
            );
        } else {
            extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.tokens.description'
                        defaultMessage='<linkTokens>Personal access tokens</linkTokens> function similarly to session tokens and can be used by integrations to <linkAPI>authenticate against the REST API</linkAPI>.'
                        values={{
                            linkTokens: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href={DeveloperLinks.PERSONAL_ACCESS_TOKENS}
                                    location='user_access_token_section'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            linkAPI: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href='https://api.mattermost.com/#tag/authentication'
                                    location='user_access_token_section'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />
                </span>
            );
        }

        let newTokenSection;
        if (this.state.tokenCreationState === TOKEN_CREATING) {
            const {enforceExpiry, maxLifetimeDays} = this.props;
            const {expiresAt} = this.state;

            const expiryLabel = expiresAt > 0 ? (
                <>
                    <FormattedDate
                        value={expiresAt}
                        year='numeric'
                        month='short'
                        day='2-digit'
                    />
                    {' '}
                    <FormattedTime value={expiresAt}/>
                </>
            ) : (
                <FormattedMessage
                    id='user.settings.tokens.expiry.none'
                    defaultMessage='No expiry'
                />
            );

            const expirySection = (
                <div className='row pt-3'>
                    <label className='col-sm-auto control-label pr-3'>
                        <FormattedMessage
                            id='user.settings.tokens.expiry'
                            defaultMessage='Expires: '
                        />
                    </label>
                    <div className='col-sm-auto'>
                        <span className='pr-2'>{expiryLabel}</span>
                        <Button
                            emphasis='tertiary'
                            size='sm'
                            onClick={this.openExpiryPicker}
                        >
                            {expiresAt > 0 ? (
                                <FormattedMessage
                                    id='user.settings.tokens.changeExpiry'
                                    defaultMessage='Change'
                                />
                            ) : (
                                <FormattedMessage
                                    id='user.settings.tokens.setExpiry'
                                    defaultMessage='Set expiry'
                                />
                            )}
                        </Button>
                        {expiresAt > 0 && !enforceExpiry ? (
                            <Button
                                emphasis='tertiary'
                                size='sm'
                                onClick={this.clearExpiry}
                            >
                                <FormattedMessage
                                    id='user.settings.tokens.clearExpiry'
                                    defaultMessage='Clear'
                                />
                            </Button>
                        ) : null}
                        {maxLifetimeDays > 0 && (
                            <div className='pt-2'>
                                <FormattedMessage
                                    id='user.settings.tokens.maxLifetimeHint'
                                    defaultMessage='Tokens can be valid for up to {days, number} {days, plural, one {day} other {days}}.'
                                    values={{days: maxLifetimeDays}}
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

            newTokenSection = (
                <div className='pl-3'>
                    <div className='row'>
                        <label
                            className='col-sm-auto control-label pr-3'
                            htmlFor='newTokenDescription'
                        >
                            <FormattedMessage
                                id='user.settings.tokens.name'
                                defaultMessage='Token Description: '
                            />
                        </label>
                        <div className='col-sm-5'>
                            <input
                                id='newTokenDescription'
                                autoFocus={true}
                                ref={this.newtokendescriptionRef}
                                className='form-control'
                                type='text'
                                maxLength={64}
                                onKeyPress={this.saveTokenKeyPress}
                            />
                        </div>
                    </div>
                    {expirySection}
                    <div>
                        <div className='pt-3'>
                            <FormattedMessage
                                id='user.settings.tokens.nameHelp'
                                defaultMessage='Enter a description for your token to remember what it does.'
                            />
                        </div>
                        <div>
                            <label
                                id='clientError'
                                className='has-error mt-2 mb-2'
                            >
                                {this.state.tokenError}
                            </label>
                        </div>
                        <SaveButton
                            savingMessage={
                                <FormattedMessage
                                    id='user.settings.tokens.save'
                                    defaultMessage='Save'
                                />
                            }
                            saving={this.state.saving}
                            onClick={this.confirmCreateToken}
                        />
                        <Button
                            emphasis='tertiary'
                            onClick={this.stopCreatingToken}
                        >
                            <FormattedMessage
                                id='user.settings.tokens.cancel'
                                defaultMessage='Cancel'
                            />
                        </Button>
                    </div>
                </div>
            );
        } else if (this.state.tokenCreationState === TOKEN_CREATED) {
            if (tokenList.length === 0) {
                tokenListClass = ' hidden';
            }

            newTokenSection = (
                <div
                    className='alert alert-warning'
                >
                    <WarningIcon additionalClassName='mr-2'/>
                    <FormattedMessage
                        id='user.settings.tokens.copy'
                        defaultMessage="Please copy the access token below. You won't be able to see it again!"
                    />
                    <br/>
                    <br/>
                    <div className='whitespace--nowrap overflow--ellipsis'>
                        <FormattedMessage
                            id='user.settings.tokens.name'
                            defaultMessage='Token Description: '
                        />
                        {this.state.newToken!.description}
                    </div>
                    <div className='whitespace--nowrap overflow--ellipsis'>
                        <FormattedMessage
                            id='user.settings.tokens.id'
                            defaultMessage='Token ID: '
                        />
                        {this.state.newToken!.id}
                    </div>
                    <strong className='word-break--all'>
                        <FormattedMessage
                            id='user.settings.tokens.token'
                            defaultMessage='Access Token: '
                        />
                        {this.state.newToken!.token}
                    </strong>
                </div>
            );
        } else {
            newTokenSection = (
                <Button
                    emphasis='primary'
                    onClick={this.startCreatingToken}
                >
                    <FormattedMessage
                        id='user.settings.tokens.create'
                        defaultMessage='Create Token'
                    />
                </Button>
            );
        }

        const inputs = [];
        inputs.push(
            <div
                key='tokensSetting'
                className='pt-2'
            >
                <div key='tokenList'>
                    <div className={'alert alert-transparent' + tokenListClass}>
                        {tokenList}
                        {noTokenText}
                    </div>
                    {newTokenSection}
                </div>
            </div>,
        );

        return (
            <div>
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.tokens.title'
                            defaultMessage='Personal Access Tokens'
                        />
                    }
                    inputs={inputs}
                    extraInfo={extraInfo}
                    infoPosition='top'
                    serverError={this.state.serverError}
                    updateSection={this.props.updateSection}
                    isFullWidth={true}
                    saving={this.state.saving}
                    cancelButtonText={
                        <FormattedMessage
                            id='user.settings.security.close'
                            defaultMessage='Close'
                        />
                    }
                />
                <ConfirmModal
                    title={this.state.confirmTitle}
                    message={this.state.confirmMessage ? this.state.confirmMessage(this.state) : null}
                    confirmButtonText={this.state.confirmButton}
                    show={this.state.showConfirmModal}
                    onConfirm={this.state.confirmComplete || (() => null)}
                    onCancel={this.handleCancelConfirm}
                    hideCancel={this.state.confirmHideCancel}
                />
                {this.state.showExpiryPicker && (
                    <DateTimePickerModal
                        ariaLabel={this.props.intl.formatMessage({
                            id: 'user.settings.tokens.pickerHeader',
                            defaultMessage: 'Select token expiry',
                        })}
                        header={
                            <FormattedMessage
                                id='user.settings.tokens.pickerHeader'
                                defaultMessage='Select token expiry'
                            />
                        }
                        subheading={this.props.maxLifetimeDays > 0 ? (
                            <FormattedMessage
                                id='user.settings.tokens.maxLifetimeHint'
                                defaultMessage='Tokens can be valid for up to {days, number} {days, plural, one {day} other {days}}.'
                                values={{days: this.props.maxLifetimeDays}}
                            />
                        ) : undefined}
                        initialTime={this.state.expiresAt > 0 ? moment(this.state.expiresAt) : moment().add(this.props.maxLifetimeDays > 0 ? Math.min(DEFAULT_EXPIRY_DAYS, this.props.maxLifetimeDays) : DEFAULT_EXPIRY_DAYS, 'days')}
                        confirmButtonText={
                            <FormattedMessage
                                id='user.settings.tokens.pickerConfirm'
                                defaultMessage='Set expiry'
                            />
                        }
                        onConfirm={this.handleExpiryConfirm}
                        onCancel={this.closeExpiryPicker}
                        onExited={this.closeExpiryPicker}
                    />
                )}
            </div>
        );
    }
}

export default injectIntl(UserAccessTokenSection);

