// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {UserAccessToken, UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import ConfirmModal from 'components/confirm_modal';
import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import SaveButton from 'components/save_button';
import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

import {Constants, DeveloperLinks} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {isMobile} from 'utils/user_agent';
import * as Utils from 'utils/utils';

const SECTION_TOKENS = 'tokens';
const TOKEN_CREATING = 'creating';
const TOKEN_CREATED = 'created';
const TOKEN_NOT_CREATING = 'not_creating';

type Props = {
    user: UserProfile;
    active?: boolean;
    areAllSectionsInactive: boolean;
    updateSection: (section: string) => void;
    userAccessTokens: {[tokenId: string]: {description: string; id: string; is_active: boolean}};
    setRequireConfirm: (isRequiredConfirm: boolean, confirmCopyToken: (confirmAction: () => void) => void) => void;
    actions: {
        getUserAccessTokensForUser: (userId: string, page: number, perPage: number) => void;
        createUserAccessToken: (userId: string, description: string) => Promise<ActionResult<UserAccessToken>>;
        revokeUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        enableUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        disableUserAccessToken: (tokenId: string) => Promise<ActionResult>;
        clearUserAccessTokens: () => void;
    };
}

type State = {
    active?: boolean;
    showConfirmModal: boolean;
    newToken?: UserAccessToken | null;
    tokenCreationState?: string;
    tokenError?: string;
    serverError?: string|null;
    saving?: boolean;
    confirmTitle?: React.ReactNode;
    confirmMessage?: ((state: State) => JSX.Element)|null;
    confirmButton?: React.ReactNode;
    confirmComplete?: (() => void)|null;
    confirmHideCancel?: boolean;
}

export default class UserAccessTokenSection extends React.PureComponent<Props, State> {
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
            };
        }
        return {active: nextProps.active};
    }

    focusEditButton(): void {
        this.minRef.current?.focus();
    }

    startCreatingToken = () => {
        this.setState({tokenCreationState: TOKEN_CREATING});
    };

    stopCreatingToken = () => {
        this.setState({tokenCreationState: TOKEN_NOT_CREATING, saving: false});
    };

    handleCreateToken = async () => {
        this.handleCancelConfirm();

        const description = this.newtokendescriptionRef ? this.newtokendescriptionRef.current!.value : '';

        if (description === '') {
            this.setState({tokenError: Utils.localizeMessage('user.settings.tokens.nameRequired', 'Please enter a description.')});
            return;
        }

        this.setState({tokenError: '', saving: true});
        this.props.setRequireConfirm(true, this.confirmCopyToken);

        const userId = this.props.user ? this.props.user.id : '';
        const {data, error} = await this.props.actions.createUserAccessToken(userId, description);

        if (data && this.state.tokenCreationState === TOKEN_CREATING) {
            this.setState({tokenCreationState: TOKEN_CREATED, newToken: data, saving: false});
        } else if (error) {
            this.setState({serverError: error.message, saving: false});
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
                trackEvent('settings', 'system_admin_create_user_access_token');
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
                    <FormattedMarkdownMessage
                        id='user.settings.tokens.confirmDeleteMessage'
                        defaultMessage='Any integrations using this token will no longer be able to access the Mattermost API. You cannot undo this action. \n \nAre you sure want to delete the **{description}** token?'
                        values={{
                            description: token.description,
                        }}
                    />
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
                trackEvent('settings', 'revoke_user_access_token');
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
        } else {
            trackEvent('settings', 'activate_user_access_token');
        }
    };

    deactivateToken = async (tokenId: string) => {
        const {error} = await this.props.actions.disableUserAccessToken(tokenId);
        if (error) {
            this.setState({serverError: error.message});
        } else {
            trackEvent('settings', 'deactivate_user_access_token');
        }
    };

    render() {
        let tokenListClass = '';

        if (!this.props.active) {
            const describe = Utils.localizeMessage('user.settings.tokens.clickToEdit', "Click 'Edit' to manage your personal access tokens");

            return (
                <SettingItemMin
                    title={Utils.localizeMessage('user.settings.tokens.title', 'Personal Access Tokens')}
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
            let activeStatus;

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
                activeStatus = (
                    <span className='has-error setting-box__inline-error'>
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
                        {activeStatus}
                    </div>
                    <div className='setting-box__token-id whitespace--nowrap overflow--ellipsis'>
                        <FormattedMessage
                            id='user.settings.tokens.tokenId'
                            defaultMessage='Token ID: '
                        />
                        {token.id}
                    </div>
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
            newTokenSection = (
                <div className='pl-3'>
                    <div className='row'>
                        <label className='col-sm-auto control-label pr-3'>
                            <FormattedMessage
                                id='user.settings.tokens.name'
                                defaultMessage='Token Description: '
                            />
                        </label>
                        <div className='col-sm-5'>
                            <input
                                autoFocus={true}
                                ref={this.newtokendescriptionRef}
                                className='form-control'
                                type='text'
                                maxLength={64}
                                onKeyPress={this.saveTokenKeyPress}
                            />
                        </div>
                    </div>
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
                        <button
                            className='btn btn-tertiary'
                            onClick={this.stopCreatingToken}
                        >
                            <FormattedMessage
                                id='user.settings.tokens.cancel'
                                defaultMessage='Cancel'
                            />
                        </button>
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
                <a
                    className='btn btn-primary'
                    href='#'
                    onClick={this.startCreatingToken}
                >
                    <FormattedMessage
                        id='user.settings.tokens.create'
                        defaultMessage='Create Token'
                    />
                </a>
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
                    title={Utils.localizeMessage('user.settings.tokens.title', 'Personal Access Tokens')}
                    inputs={inputs}
                    extraInfo={extraInfo}
                    infoPosition='top'
                    serverError={this.state.serverError}
                    updateSection={this.props.updateSection}
                    width='full'
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
