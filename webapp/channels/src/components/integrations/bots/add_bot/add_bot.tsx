// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {FormattedMessage} from 'react-intl';

import * as FileUtils from 'utils/file_utils';

import * as UserUtils from 'mattermost-redux/utils/user_utils';
import {General} from 'mattermost-redux/constants';

import BotDefaultIcon from 'images/bot_default_icon.png';

import BackstageHeader from 'components/backstage/components/backstage_header';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import SpinnerButton from 'components/spinner_button';
import FormError from 'components/form_error';

import {getHistory} from 'utils/browser_history';
import {AcceptedProfileImageTypes, Constants, DeveloperLinks, ValidationErrors} from 'utils/constants';
import * as Utils from 'utils/utils';

import {Team} from '@mattermost/types/teams';
import {Bot, BotPatch} from '@mattermost/types/bots';
import {UserProfile} from '@mattermost/types/users';
import {ActionResult} from 'mattermost-redux/types/actions';
import ExternalLink from 'components/external_link';

const roleOptionSystemAdmin = 'System Admin';
const roleOptionMember = 'Member';

export type Props = {

    /**
     *  Only used for routing since backstage is team based.
     */
    team: Team;

    /**
     *  Bot to edit (if editing)
     */
    bot?: Bot;

    /**
     *  Bot user
     */
    user?: UserProfile;

    /**
     *  Roles of the bot to edit (if editing)
     */
    roles?: string;

    /**
     * Maximum upload file size (for bot account profile picture)
     */
    maxFileSize: number;

    /**
     * Editing user has the MANAGE_SYSTEM permission
     */
    editingUserHasManageSystem: boolean;

    /**
     * Bot to edit
     */
    actions: {

        /**
         * Creates a new bot account.
         */
        createBot: (bot: Partial<Bot>) => ActionResult;

        /**
         * Patches an existing bot account.
         */
        patchBot: (botUserId: string, botPatch: Partial<BotPatch>) => ActionResult;

        /**
         * Uploads a user profile image
         */
        uploadProfileImage: (userId: string, image: File | string) => ActionResult;

        /**
         * Set profile image to default
         */
        setDefaultProfileImage: (userId: string) => ActionResult;

        /**
         * For creating default access token
         */
        createUserAccessToken: (userId: string, description: string) => ActionResult;

        /**
         * For creating setting bot to system admin or special posting permissions
         */
        updateUserRoles: (userId: string, roles: string) => ActionResult;
    };
};

export type State = {
    username: string;
    displayName: string | undefined;
    description: string | undefined;
    role: string;
    postAll: boolean;
    postChannels: boolean;
    error: JSX.Element | string;
    adding: boolean;
    image: string;
    orientationStyles: {transform: string; transformOrigin: string};
    pictureFile: File | null | string;
};

export default class AddBot extends React.PureComponent<Props, State> {
    previewBlob: string | null = null;
    constructor(props: Props) {
        super(props);

        this.state = {
            error: '',
            username: this.props.bot ? this.props.bot.username : '',
            displayName: this.props.bot ? this.props.bot.display_name : '',
            description: this.props.bot ? this.props.bot.description : '',
            adding: false,
            image: BotDefaultIcon,
            role: UserUtils.isSystemAdmin(this.props.roles || '') ? roleOptionSystemAdmin : roleOptionMember,
            postAll: this.props.bot ? UserUtils.hasPostAllRole(this.props.roles || '') : false,
            postChannels: this.props.bot ? UserUtils.hasPostAllPublicRole(this.props.roles || '') : false,
            orientationStyles: {transform: '', transformOrigin: ''},
            pictureFile: null,
        };
    }

    updateUsername = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            username: e.target.value,
        });
    };

    updateDisplayName = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            displayName: e.target.value,
        });
    };

    updateDescription = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            description: e.target.value,
        });
    };

    updateRole = (e: ChangeEvent<HTMLSelectElement>) => {
        this.setState({
            role: e.target.value,
        });
    };

    updatePostAll = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            postAll: e.target.checked,
        });
    };

    updatePostChannels = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            postChannels: e.target.checked,
        });
    };

    updatePicture = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const pictureFile = e.target.files[0];
            this.previewBlob = URL.createObjectURL(pictureFile);

            const reader = new FileReader();
            reader.onload = (e2) => {
                const orientation = FileUtils.getExifOrientation(e2.target?.result as ArrayBuffer);
                const orientationStyles = FileUtils.getOrientationStyles(orientation);

                this.setState({
                    image: this.previewBlob || '',
                    orientationStyles,
                });
            };
            reader.readAsArrayBuffer(pictureFile);
            e.target.value = '';
            this.setState({pictureFile});
        } else {
            this.setState({pictureFile: null, image: ''});
        }
    };

    setDefault = () => {
        this.setState({pictureFile: 'default', image: BotDefaultIcon});
    };

    isFile(file: File | string): file is File {
        return (file as File).size !== undefined;
    }

    updateRoles = async (data: Bot) => {
        let roles = General.SYSTEM_USER_ROLE;

        if (this.state.role === roleOptionSystemAdmin) {
            roles += ' ' + General.SYSTEM_ADMIN_ROLE;
        } else if (this.state.postAll) {
            roles += ' ' + General.SYSTEM_POST_ALL_ROLE;
        } else if (this.state.postChannels) {
            roles += ' ' + General.SYSTEM_POST_ALL_PUBLIC_ROLE;
        }

        const rolesResult = await this.props.actions.updateUserRoles(data.user_id, roles);
        if (rolesResult) {
            return rolesResult.error;
        }

        return null;
    };

    handleSubmit = async (e: FormEvent<HTMLButtonElement | HTMLFormElement>) => {
        e.preventDefault();

        if (this.state.adding) {
            return;
        }

        if (!this.state.username || this.state.username.length < 3) {
            this.setState({
                error: (
                    <FormattedMessage
                        id='bots.manage.add.invalid_username'
                        defaultMessage='Usernames have to begin with a lowercase letter and be 3-22 characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.'
                    />
                ),
            });
            return;
        }

        if (this.state.pictureFile && this.isFile(this.state.pictureFile)) {
            if (!AcceptedProfileImageTypes.includes(this.state.pictureFile.type)) {
                this.setState({
                    error: (
                        <FormattedMessage
                            id='user.settings.general.validImage'
                            defaultMessage='Only BMP, JPG or PNG images may be used for profile pictures'
                        />
                    ),
                });
                return;
            } else if (this.state.pictureFile.size > this.props.maxFileSize) {
                this.setState({
                    error: (
                        <FormattedMessage
                            id='user.settings.general.imageTooLarge'
                            defaultMessage='Unable to upload profile image. File is too large.'
                        />
                    ),
                });
                return;
            }
        }

        this.setState({
            adding: true,
            error: '',
        });

        const bot = {
            username: this.state.username.toLowerCase().trim(),
            display_name: this.state.displayName,
            description: this.state.description,
        };

        let data: Bot | undefined;
        let error;
        if (this.props.bot) {
            const result = await this.props.actions.patchBot(this.props.bot.user_id, bot);
            if (result) {
                data = result.data;
                error = result.error;
            } else {
                error = Utils.localizeMessage('bot.edit_failed', 'Failed to edit bot');
            }

            if (!error && data) {
                if (this.state.pictureFile && this.state.pictureFile !== 'default') {
                    const imageResult = await this.props.actions.uploadProfileImage(data.user_id, this.state.pictureFile);
                    error = imageResult.error;
                } else if (this.state.pictureFile && this.state.pictureFile === 'default') {
                    await this.props.actions.setDefaultProfileImage(data.user_id);
                }
            }

            if (!error && data) {
                error = this.updateRoles(data);
            }

            if (data) {
                getHistory().push(`/${this.props.team.name}/integrations/bots`);
                return;
            }
        } else {
            const usernameError = Utils.isValidBotUsername(bot.username);
            if (usernameError) {
                let errObj;
                if (usernameError.id === ValidationErrors.INVALID_LAST_CHARACTER) {
                    errObj = {
                        adding: false,
                        error: (
                            <FormattedMessage
                                id='bots.manage.add.invalid_last_char'
                                defaultMessage='Bot usernames cannot have a period as the last character'
                            />
                        ),
                    };
                } else {
                    errObj = {
                        adding: false,
                        error: (
                            <FormattedMessage
                                id='bots.manage.add.invalid_username'
                                defaultMessage='Usernames have to begin with a lowercase letter and be 3-22 characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.'
                            />
                        ),
                    };
                }
                this.setState(errObj);
                return;
            }

            const result = await this.props.actions.createBot(bot);
            if (result) {
                data = result.data;
                error = result.error;
            } else {
                error = Utils.localizeMessage('bot.create_failed', 'Failed to create bot');
            }

            let token = '';
            if (!error && data) {
                if (this.state.pictureFile && this.state.pictureFile !== 'default') {
                    await this.props.actions.uploadProfileImage(data.user_id, this.state.pictureFile);
                } else {
                    await this.props.actions.setDefaultProfileImage(data.user_id);
                }
                const tokenResult = await this.props.actions.createUserAccessToken(data.user_id,
                    Utils.localizeMessage('bot.token.default.description', 'Default Token'),
                );

                // On error just skip the confirmation because we have a bot without a token.
                if (!tokenResult || tokenResult.error) {
                    getHistory().push(`/${this.props.team.name}/integrations/bots`);
                    return;
                }

                token = tokenResult.data.token;
            }

            if (!error && data) {
                error = this.updateRoles(data);
            }

            if (data) {
                getHistory().push(`/${this.props.team.name}/integrations/confirm?type=bots&id=${data.user_id}&token=${token}`);
                return;
            }
        }

        this.setState({
            adding: false,
        });

        if (error) {
            this.setState({
                error: error.message,
            });
        }
    };

    render() {
        let subtitle = (
            <FormattedMessage
                id='bots.manage.add.add'
                defaultMessage='Add'
            />
        );
        let buttonText = (
            <FormattedMessage
                id='bots.manage.add.create'
                defaultMessage='Create Bot Account'
            />
        );
        let buttonActiveText = (
            <FormattedMessage
                id='bots.manage.add.creating'
                defaultMessage='Creating...'
            />
        );

        // If we are editing
        if (this.props.bot) {
            subtitle = (
                <FormattedMessage
                    id='bots.manage.edit'
                    defaultMessage='Edit'
                />
            );
            buttonText = (
                <FormattedMessage
                    id='bots.manage.edit.title'
                    defaultMessage='Update'
                />
            );
            buttonActiveText = (
                <FormattedMessage
                    id='bots.manage.edit.editing'
                    defaultMessage='Updating...'
                />
            );
        }

        let imageURL = '';
        let removeImageIcon: JSX.Element | null = (
            <OverlayTrigger
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='right'
                overlay={(
                    <Tooltip id='removeIcon'>
                        <FormattedMessage
                            id='bot.remove_profile_picture'
                            defaultMessage='Remove Bot Icon'
                        />
                    </Tooltip>
                )}
            >
                <a
                    className={'bot-profile__remove'}
                    onClick={this.setDefault}
                >
                    <span>{'×'}</span>
                </a>
            </OverlayTrigger>
        );
        let imageStyles;
        if (this.props.bot && !this.state.pictureFile) {
            if (this.props.user) {
                imageURL = Utils.imageURLForUser(this.props.user.id, this.props.user.last_picture_update);
            } else {
                imageURL = Utils.imageURLForUser(this.props.bot.user_id);
            }
        } else {
            imageURL = this.state.image;
            imageStyles = this.state.orientationStyles;
            if (this.state.image === BotDefaultIcon) {
                removeImageIcon = null;
            }
        }

        return (
            <div className='backstage-content'>
                <BackstageHeader>
                    <Link to={`/${this.props.team.name}/integrations/bots`}>
                        <FormattedMessage
                            id='bots.manage.header'
                            defaultMessage='Bot Accounts'
                        />
                    </Link>
                    {subtitle}
                </BackstageHeader>
                <div className='backstage-form'>
                    <form
                        className='form-horizontal'
                        onSubmit={this.handleSubmit}
                    >
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='username'
                            >
                                <FormattedMessage
                                    id='bots.add.username'
                                    defaultMessage='Username'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='username'
                                    type='text'
                                    maxLength={22}
                                    className='form-control'
                                    value={this.state.username}
                                    onChange={this.updateUsername}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='bot.add.username.help'
                                        defaultMessage='You can use lowercase letters, numbers, periods, dashes, and underscores.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='boticon'
                            >
                                <FormattedMessage
                                    id='bots.add.icon'
                                    defaultMessage='Bot Icon'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <div className={'bot-img-container'}>
                                    <img
                                        className={'bot-img'}
                                        alt={'bot image'}
                                        src={imageURL}
                                        style={imageStyles}
                                    />
                                    {removeImageIcon}
                                </div>
                                <div
                                    className='btn btn-sm btn-primary btn-file'
                                >
                                    <FormattedMessage
                                        id='bots.image.upload'
                                        defaultMessage='Upload Image'
                                    />
                                    <input
                                        accept={Constants.ACCEPT_STATIC_IMAGE}
                                        type='file'
                                        onChange={this.updatePicture}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='displayName'
                            >
                                <FormattedMessage
                                    id='bots.add.displayName'
                                    defaultMessage='Display Name'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='displayName'
                                    type='text'
                                    maxLength={64}
                                    className='form-control'
                                    value={this.state.displayName}
                                    onChange={this.updateDisplayName}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='bot.add.display_name.help'
                                        defaultMessage={'(Optional) You can choose to display your bot\'s full name rather than its username.'}
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
                                    id='bot.add.description'
                                    defaultMessage='Description'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='description'
                                    type='text'
                                    maxLength={1024}
                                    className='form-control'
                                    value={this.state.description}
                                    onChange={this.updateDescription}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='bot.add.description.help'
                                        defaultMessage='(Optional) Let others know what this bot does.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='role'
                            >
                                <FormattedMessage
                                    id='bot.add.role'
                                    defaultMessage='Role'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <select
                                    className='form-control'
                                    value={this.state.role}
                                    disabled={!this.props.editingUserHasManageSystem}
                                    onChange={this.updateRole}
                                >
                                    <option
                                        value={roleOptionMember}
                                    >
                                        {Utils.localizeMessage('bot.add.role.member', 'Member')}
                                    </option>
                                    <option
                                        value={roleOptionSystemAdmin}
                                    >
                                        {Utils.localizeMessage('bot.add.role.admin', 'System Admin')}
                                    </option>
                                </select>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='bot.add.role.help'
                                        defaultMessage='Choose what role the bot should have.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='row bot-profile__section'>
                            <div className='col-md-5 col-sm-8 col-sm-offset-4'>
                                <FormattedMessage
                                    id='admin.manage_roles.botAdditionalRoles'
                                    defaultMessage='Select additional permissions for the account. <link>Read more about roles and permissions</link>.'
                                    values={{
                                        link: (msg: React.ReactNode) => (
                                            <ExternalLink
                                                href={DeveloperLinks.PERSONAL_ACCESS_TOKENS}
                                                location='add_bot'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                    }}
                                />
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='postAll'
                            >
                                <FormattedMessage
                                    id='bot.add.post_all'
                                    defaultMessage='post:all'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8 checkbox'>
                                <div className='checkbox no-padding'>
                                    <label htmlFor='postAll'>
                                        <input
                                            id='postAll'
                                            type='checkbox'
                                            checked={this.state.postAll || this.state.role === roleOptionSystemAdmin}
                                            onChange={this.updatePostAll}
                                            disabled={!this.props.editingUserHasManageSystem || this.state.role === roleOptionSystemAdmin}
                                        />
                                        <FormattedMessage
                                            id='bot.add.post_all.enabled'
                                            defaultMessage='Enabled'
                                        />
                                    </label>
                                </div>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='bot.add.post_all.help'
                                        defaultMessage='Bot will have access to post to all Mattermost channels including direct messages.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='postChannels'
                            >
                                <FormattedMessage
                                    id='bot.add.post_channels'
                                    defaultMessage='post:channels'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8 checkbox'>
                                <div className='checkbox no-padding'>
                                    <label htmlFor='postChannels'>
                                        <input
                                            id='postChannels'
                                            type='checkbox'
                                            checked={this.state.postChannels || this.state.role === roleOptionSystemAdmin || this.state.postAll}
                                            onChange={this.updatePostChannels}
                                            disabled={!this.props.editingUserHasManageSystem || this.state.role === roleOptionSystemAdmin || this.state.postAll}
                                        />
                                        <FormattedMessage
                                            id='bot.add.post_channels.enabled'
                                            defaultMessage='Enabled'
                                        />
                                    </label>
                                </div>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='bot.add.post_channels.help'
                                        defaultMessage='Bot will have access to post to all Mattermost public channels.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                errors={[this.state.error]}
                            />
                            <Link
                                className='btn btn-tertiary'
                                to={`/${this.props.team.name}/integrations/bots`}
                            >
                                <FormattedMessage
                                    id='bots.manage.add.cancel'
                                    defaultMessage='Cancel'
                                />
                            </Link>
                            <SpinnerButton
                                className='btn btn-primary'
                                type='submit'
                                spinning={this.state.adding}
                                spinningText={buttonActiveText}
                                onClick={this.handleSubmit}
                                id='saveBot'
                            >
                                {buttonText}
                            </SpinnerButton>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}
