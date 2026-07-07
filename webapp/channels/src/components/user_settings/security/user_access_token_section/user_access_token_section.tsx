// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ExpiryPreset = 'none' | '7d' | '30d' | '90d' | '1y' | 'custom';

export const PRESET_DAYS: Record<Exclude<ExpiryPreset, 'none' | 'custom'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
};

export function endOfLocalDayPlusDays(days: number): number {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

export function endOfLocalDayFromIsoDate(isoDate: string): number {
    // isoDate is YYYY-MM-DD from <input type="date">; parse as local date.
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!y || !m || !d) {
        return 0;
    }
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

// The presets and custom dates resolve to end-of-local-day, which can sit up to
// ~24h beyond the server's cap of "now + maxLifetimeDays" (the server measures an
// exact duration from the moment of creation, not end-of-day). Clamp the submitted
// value to that cap so the in-range presets (including the default, which equals the
// cap) and the maximum selectable custom date are accepted. The server evaluates its
// cap slightly later than this, so the clamped value stays safely under it.
export function clampExpiresAtToMaxLifetime(expiresAt: number, maxLifetimeDays: number): number {
    if (expiresAt > 0 && maxLifetimeDays > 0) {
        return Math.min(expiresAt, Date.now() + (maxLifetimeDays * MS_PER_DAY));
    }
    return expiresAt;
}

function todayIso(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

function isoPlusDays(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

export type TokenStatus = 'active' | 'expired' | 'inactive';

export function deriveTokenStatus(token: {is_active: boolean; expires_at?: number}): TokenStatus {
    if (!token.is_active) {
        return 'inactive';
    }
    if (token.expires_at && token.expires_at > 0 && token.expires_at < Date.now()) {
        return 'expired';
    }
    return 'active';
}

export function mapServerErrorIdToMessage(errorId?: string, maxDays?: number): React.ReactNode | null {
    switch (errorId) {
    case 'app.user_access_token.expires_at_required.app_error':
    case 'expires_at_required':
        return (
            <FormattedMessage
                id='user.settings.tokens.expiryRequired'
                defaultMessage='An expiry date is required.'
            />
        );
    case 'app.user_access_token.expires_at_in_past.app_error':
    case 'expires_at_in_past':
        return (
            <FormattedMessage
                id='user.settings.tokens.expiryInPast'
                defaultMessage='Expiry must be in the future.'
            />
        );
    case 'app.user_access_token.expires_at_too_far.app_error':
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
};

type Props = OwnProps & WrappedComponentProps;

type State = {
    active?: boolean;
    showConfirmModal: boolean;
    newToken?: UserAccessToken | null;
    tokenCreationState?: string;
    tokenError?: React.ReactNode;
    serverError?: string | null;
    saving?: boolean;
    confirmTitle?: React.ReactNode;
    confirmMessage?: ((state: State) => JSX.Element) | null;
    confirmButton?: React.ReactNode;
    confirmComplete?: (() => void) | null;
    confirmHideCancel?: boolean;
    expiryPreset: ExpiryPreset;
    customExpiryDate: string;
    tokenDescription: string;
};

class UserAccessTokenSection extends React.PureComponent<Props, State> {
    private minRef: React.RefObject<SettingItemMinComponent>;

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
            expiryPreset: this.defaultExpiryPreset(),
            customExpiryDate: this.defaultCustomExpiryDate(),
            tokenDescription: '',
        };
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
            };
        }
        return {active: nextProps.active};
    }

    defaultCustomExpiryDate = (): string => {
        const {maxLifetimeDays} = this.props;
        if (maxLifetimeDays > 0) {
            return isoPlusDays(Math.max(1, Math.min(30, maxLifetimeDays)));
        }
        return isoPlusDays(30);
    };

    defaultExpiryPreset = (): ExpiryPreset => {
        // A configured maximum lifetime (> 0) implies tokens must expire, so the
        // "No expiry" option is not offered and a bounded preset is the default.
        if (this.props.maxLifetimeDays <= 0) {
            return 'none';
        }
        const presets: ExpiryPreset[] = ['30d', '7d'];
        for (const p of presets) {
            if (this.isPresetAllowed(p)) {
                return p;
            }
        }
        return 'custom';
    };

    isPresetAllowed = (preset: ExpiryPreset): boolean => {
        const {maxLifetimeDays} = this.props;
        if (preset === 'none' || preset === 'custom') {
            return true;
        }
        return maxLifetimeDays <= 0 || PRESET_DAYS[preset] <= maxLifetimeDays;
    };

    resolveExpiresAt = (): number => {
        const {expiryPreset, customExpiryDate} = this.state;
        if (expiryPreset === 'none') {
            return 0;
        }
        if (expiryPreset === 'custom') {
            return endOfLocalDayFromIsoDate(customExpiryDate);
        }
        return endOfLocalDayPlusDays(PRESET_DAYS[expiryPreset]);
    };

    // Validates the current expiry selection and returns a localized error message,
    // or null when the selection is valid. Used both to disable the Save button and
    // surface the error inline (so the user sees it without clicking through the
    // create-confirmation flow) and as the guard in handleCreateToken.
    getExpiryValidationError = (): React.ReactNode | null => {
        const {maxLifetimeDays} = this.props;
        const enforceExpiry = maxLifetimeDays > 0;
        const {expiryPreset} = this.state;
        const expiresAt = this.resolveExpiresAt();

        if (expiryPreset === 'custom' && expiresAt <= 0) {
            return mapServerErrorIdToMessage('expires_at_required');
        }
        if (enforceExpiry && expiresAt <= 0) {
            return mapServerErrorIdToMessage('expires_at_required');
        }
        if (expiresAt > 0 && expiresAt <= Date.now()) {
            return mapServerErrorIdToMessage('expires_at_in_past');
        }
        if (expiresAt > 0 && maxLifetimeDays > 0) {
            const maxAllowed = endOfLocalDayPlusDays(maxLifetimeDays);
            if (expiresAt > maxAllowed) {
                return mapServerErrorIdToMessage('expires_at_too_far', maxLifetimeDays);
            }
        }
        return null;
    };

    focusEditButton(): void {
        this.minRef.current?.focus();
    }

    startCreatingToken = () => {
        this.setState({
            tokenCreationState: TOKEN_CREATING,
            expiryPreset: this.defaultExpiryPreset(),
            customExpiryDate: this.defaultCustomExpiryDate(),
            tokenDescription: '',
            tokenError: '',
        });
    };

    handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({tokenDescription: e.target.value, tokenError: ''});
    };

    stopCreatingToken = () => {
        this.setState({
            tokenCreationState: TOKEN_NOT_CREATING,
            saving: false,
            tokenError: '',
        });
    };

    handleExpiryPresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        this.setState({expiryPreset: e.target.value as ExpiryPreset, tokenError: ''});
    };

    handleCustomExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({customExpiryDate: e.target.value, tokenError: ''});
    };

    handleCreateToken = async () => {
        this.handleCancelConfirm();

        const description = this.state.tokenDescription.trim();

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

        const expiryError = this.getExpiryValidationError();
        if (expiryError) {
            this.setState({tokenError: expiryError});
            return;
        }

        const {maxLifetimeDays} = this.props;
        const expiresAt = this.resolveExpiresAt();

        this.setState({tokenError: '', saving: true});
        this.props.setRequireConfirm(true, this.confirmCopyToken);

        // Validation above runs on the raw end-of-day value so an explicitly
        // out-of-range custom date is still rejected; the submitted value is clamped
        // to the server cap so in-range end-of-day expiries aren't rejected as too far.
        const clampedExpiresAt = clampExpiresAtToMaxLifetime(expiresAt, maxLifetimeDays);

        const userId = this.props.user ? this.props.user.id : '';
        const {data, error} = await this.props.actions.createUserAccessToken(userId, description, clampedExpiresAt > 0 ? clampedExpiresAt : undefined);

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
            const approachingExpiry = status === 'active' && hasExpiry && msUntilExpiry > 0 && msUntilExpiry < APPROACHING_EXPIRY_DAYS * MS_PER_DAY;

            // Count whole calendar days from the start of today to the expiry day. Expiries
            // land on end-of-local-day, so measuring from start-of-today and flooring avoids
            // over-reporting by one (e.g. a 7-day token reads "7 days", not "8").
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const daysUntilExpiry = hasExpiry ? Math.max(0, Math.floor(((token.expires_at as number) - startOfToday.getTime()) / MS_PER_DAY)) : 0;
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
                    data-testid='personalAccessTokenRow'
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
            const {maxLifetimeDays} = this.props;
            const enforceExpiry = maxLifetimeDays > 0;
            const {expiryPreset, customExpiryDate} = this.state;
            const maxCustomIso = maxLifetimeDays > 0 ? isoPlusDays(maxLifetimeDays) : undefined;

            // Validate the expiry selection up front so the error surfaces inline and the
            // Save button is disabled, instead of only failing inside the confirm flow.
            const expiryError = this.getExpiryValidationError();
            const descriptionEmpty = this.state.tokenDescription.trim() === '';

            const expirySection = (
                <div className='row pt-3'>
                    <label
                        className='col-sm-auto control-label pr-3'
                        htmlFor='newTokenExpiry'
                    >
                        <FormattedMessage
                            id='user.settings.tokens.expiry'
                            defaultMessage='Expires: '
                        />
                    </label>
                    <div className='col-sm-auto'>
                        <select
                            id='newTokenExpiry'
                            className='form-control'
                            value={expiryPreset}
                            onChange={this.handleExpiryPresetChange}
                        >
                            {!enforceExpiry && (
                                <option value='none'>
                                    {this.props.intl.formatMessage({id: 'user.settings.tokens.expiry.none', defaultMessage: 'No expiry'})}
                                </option>
                            )}
                            {this.isPresetAllowed('7d') && (
                                <option value='7d'>
                                    {this.props.intl.formatMessage({id: 'user.settings.tokens.expiry.7d', defaultMessage: '7 days'})}
                                </option>
                            )}
                            {this.isPresetAllowed('30d') && (
                                <option value='30d'>
                                    {this.props.intl.formatMessage({id: 'user.settings.tokens.expiry.30d', defaultMessage: '30 days'})}
                                </option>
                            )}
                            {this.isPresetAllowed('90d') && (
                                <option value='90d'>
                                    {this.props.intl.formatMessage({id: 'user.settings.tokens.expiry.90d', defaultMessage: '90 days'})}
                                </option>
                            )}
                            {this.isPresetAllowed('1y') && (
                                <option value='1y'>
                                    {this.props.intl.formatMessage({id: 'user.settings.tokens.expiry.1y', defaultMessage: '1 year'})}
                                </option>
                            )}
                            <option value='custom'>
                                {this.props.intl.formatMessage({id: 'user.settings.tokens.expiry.custom', defaultMessage: 'Custom date…'})}
                            </option>
                        </select>
                        {expiryPreset === 'custom' && (
                            <input
                                id='newTokenExpiryCustom'
                                className='form-control mt-2'
                                type='date'
                                aria-label={this.props.intl.formatMessage({id: 'user.settings.tokens.expiry.customDate', defaultMessage: 'Custom expiry date'})}
                                value={customExpiryDate}
                                min={todayIso()}
                                max={maxCustomIso}
                                onChange={this.handleCustomExpiryChange}
                            />
                        )}
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
                <div className='setting-box__new-token'>
                    <div className='setting-box__new-token-title'>
                        <FormattedMessage
                            id='user.settings.tokens.createHeading'
                            defaultMessage='Create New Token'
                        />
                    </div>
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
                                className='form-control'
                                type='text'
                                maxLength={64}
                                value={this.state.tokenDescription}
                                onChange={this.handleDescriptionChange}
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
                                {this.state.tokenError || expiryError}
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
                            disabled={descriptionEmpty || Boolean(expiryError)}
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
            </div>
        );
    }
}

export default injectIntl(UserAccessTokenSection);

