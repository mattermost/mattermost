// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, FormEvent, JSX} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import {buttonClassNames} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Bot} from '@mattermost/types/bots';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import BackstageHeader from 'components/backstage/components/backstage_header';
import type {ExpiryPreset} from 'components/common/token_expiry_picker/token_expiry';
import {
    clampExpiresAtToMaxLifetime,
    defaultCustomExpiryDate,
    defaultExpiryPreset,
    getExpiryValidationError,
    resolveTokenExpiresAt,
} from 'components/common/token_expiry_picker/token_expiry';
import TokenExpiryPicker from 'components/common/token_expiry_picker/token_expiry_picker';
import ExternalLink from 'components/external_link';
import FormError from 'components/form_error';
import BotEventSecret from 'components/integrations/bots/bot_event_secret';
import type {UserAttributeValue} from 'components/property_fields/user_attribute_fields';
import SpinnerButton from 'components/spinner_button';

import BotDefaultIcon from 'images/bot_default_icon.png';
import {getHistory} from 'utils/browser_history';
import {Constants, DeveloperLinks} from 'utils/constants';
import * as FileUtils from 'utils/file_utils';
import * as Utils from 'utils/utils';

import {
    addAttributeRow,
    computeAttributeChanges,
    emptyAttributesState,
    loadedAttributesState,
    markAttributesSaved,
    removeAttributeRow,
    setAttributeValue,
    validateAttributeRows,
} from './bot_attributes';
import type {BotAttributesState, BotRoleUpdate} from './bot_attributes';
import BotAttributesSection from './bot_attributes_section';
import {eventDeliveryPatch, eventDeliveryState, planEventDeliveryChange} from './bot_event_delivery';
import type {EventDeliveryState} from './bot_event_delivery';
import BotEventDeliverySection from './bot_event_delivery_section';
import {loadBotAttributeValues, saveBotCreate, saveBotEdit, validateBotForm} from './bot_save_flow';
import type {BotEditResult, BotPictureFile, BotSaveActions, BotSaveFailure} from './bot_save_flow';

const roleOptionSystemAdmin = 'System Admin';
const roleOptionMember = 'Member';

function getRoleState(roles: string | undefined, isEdit: boolean) {
    return {
        role: UserUtils.isSystemAdmin(roles || '') ? roleOptionSystemAdmin : roleOptionMember,
        postAll: isEdit ? UserUtils.hasPostAllRole(roles || '') : false,
        postChannels: isEdit ? UserUtils.hasPostAllPublicRole(roles || '') : false,
    };
}

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

    maxLifetimeDays: number;

    /**
     * Editing user has the MANAGE_SYSTEM permission, which unlocks admin-managed attributes
     */
    editingUserHasManageSystem: boolean;

    /**
     * Licensed and allowed to manage this bot (manage_bots / manage_others_bots)
     */
    attributesEnabled: boolean;
    attributeFields: UserPropertyField[];

    /**
     * May configure event delivery: always when editing (the API enforces access), manage_bots when creating
     */
    eventDeliveryEnabled: boolean;

    /**
     * Editing user has the MANAGE_ROLES permission required to change the bot's role and post permissions
     */
    canManageRoles: boolean;

    actions: BotSaveActions;
};

export type State = {
    username: string;
    displayName: string | undefined;
    description: string | undefined;
    role: string;
    postAll: boolean;
    postChannels: boolean;
    error: React.ReactNode;
    adding: boolean;
    image: string;
    orientationStyles: {transform: string; transformOrigin: string};
    pictureFile: BotPictureFile;
    expiryPreset: ExpiryPreset;
    customExpiryDate: string;
    attributes: BotAttributesState;
    eventDelivery: EventDeliveryState;

    /** Signing secret returned by saving the edit form, shown once instead of navigating away. */
    eventSecret: string;
};

export default class AddBot extends React.PureComponent<Props, State> {
    previewBlob: string | null = null;
    private submitting = false;
    private unmounted = false;

    constructor(props: Props) {
        super(props);

        this.state = {
            error: '',
            username: this.props.bot ? this.props.bot.username : '',
            displayName: this.props.bot ? this.props.bot.display_name : '',
            description: this.props.bot ? this.props.bot.description : '',
            adding: false,
            image: BotDefaultIcon,
            ...getRoleState(this.props.roles, Boolean(this.props.bot)),
            orientationStyles: {transform: '', transformOrigin: ''},
            pictureFile: null,
            expiryPreset: this.defaultExpiryPreset(),
            customExpiryDate: this.defaultCustomExpiryDate(),
            attributes: emptyAttributesState(this.props.attributesEnabled ? 'loading' : 'ready'),
            eventDelivery: this.props.bot && this.props.eventDeliveryEnabled ? {...eventDeliveryState(null), loaded: false} : eventDeliveryState(null),
            eventSecret: '',
        };
    }

    componentDidMount() {
        this.unmounted = false;
        this.loadAttributes();
        this.loadEventDelivery();
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.roles === undefined && this.props.roles !== undefined) {
            this.setState(getRoleState(this.props.roles, Boolean(this.props.bot)));
        }
    }

    componentWillUnmount() {
        this.unmounted = true;
    }

    loadAttributes = async () => {
        if (!this.props.attributesEnabled) {
            return;
        }
        const initialValues = await loadBotAttributeValues(this.props.actions, this.props.bot?.user_id);
        if (this.unmounted) {
            return;
        }
        this.setState((state) => ({
            attributes: initialValues ? loadedAttributesState(initialValues) : {...state.attributes, status: 'error'},
        }));
    };

    loadEventDelivery = async () => {
        if (!this.props.bot || !this.props.eventDeliveryEnabled) {
            return;
        }
        const result = await this.props.actions.getBotEventSubscription(this.props.bot.user_id);
        if (!this.unmounted && !result?.error) {
            this.setState({eventDelivery: eventDeliveryState(result?.data ?? null)});
        }
    };

    updateEventDelivery = (patch: Partial<EventDeliveryState>) => {
        this.setState((state) => ({eventDelivery: {...state.eventDelivery, ...patch}, error: ''}));
    };

    retryAttributes = () => {
        this.setState((state) => ({attributes: {...state.attributes, status: 'loading'}}), this.loadAttributes);
    };

    addAttributeRow = (fieldId: string) => {
        const field = this.props.attributeFields.find((f) => f.id === fieldId);
        if (field) {
            this.setState((state) => ({attributes: addAttributeRow(state.attributes, field)}));
        }
    };

    removeAttributeRow = (fieldId: string) => {
        this.setState((state) => ({attributes: removeAttributeRow(state.attributes, fieldId)}));
    };

    updateAttributeValue = (fieldId: string, value: UserAttributeValue) => {
        this.setState((state) => ({attributes: setAttributeValue(state.attributes, fieldId, value)}));
    };

    getCurrentRoles = (): string | undefined => (this.props.bot ? this.props.roles : General.SYSTEM_USER_ROLE);

    canEditRoles = (): boolean => this.props.canManageRoles && this.getCurrentRoles() !== undefined;

    getRoleUpdate = (): BotRoleUpdate | undefined => {
        const currentRoles = this.getCurrentRoles();
        if (!this.props.canManageRoles || currentRoles === undefined) {
            return undefined;
        }
        return {
            currentRoles,
            choice: {
                isAdmin: this.state.role === roleOptionSystemAdmin,
                postAll: this.state.postAll,
                postChannels: this.state.postChannels,
            },
        };
    };

    attributesReady = () => this.props.attributesEnabled && this.state.attributes.status === 'ready';

    defaultCustomExpiryDate = (): string => {
        return defaultCustomExpiryDate(this.props.maxLifetimeDays);
    };

    defaultExpiryPreset = (): ExpiryPreset => {
        return defaultExpiryPreset(this.props.maxLifetimeDays, this.props.maxLifetimeDays > 0);
    };

    resolveExpiresAt = (): number => {
        return resolveTokenExpiresAt(this.state.expiryPreset, this.state.customExpiryDate);
    };

    getExpiryValidationError = (): React.ReactNode | null => {
        return getExpiryValidationError(this.state.expiryPreset, this.state.customExpiryDate, this.props.maxLifetimeDays, this.props.maxLifetimeDays > 0, !this.props.bot);
    };

    updateExpiryPreset = (e: ChangeEvent<HTMLSelectElement>) => {
        this.setState({
            expiryPreset: e.target.value as ExpiryPreset,
            error: '',
        });
    };

    updateCustomExpiryDate = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({
            customExpiryDate: e.target.value,
            error: '',
        });
    };

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

    finishWithError = (error: React.ReactNode) => {
        this.submitting = false;
        if (!this.unmounted) {
            this.setState({adding: false, error});
        }
    };

    handleSubmit = async (e: FormEvent<HTMLButtonElement | HTMLFormElement>) => {
        e.preventDefault();

        if (this.submitting || this.state.adding) {
            return;
        }

        const formError = validateBotForm({
            username: this.state.username,
            pictureFile: this.state.pictureFile,
            maxFileSize: this.props.maxFileSize,
            isCreate: !this.props.bot,
        });
        if (formError) {
            this.setState({error: <FormattedMessage {...formError}/>});
            return;
        }

        const expiryError = this.getExpiryValidationError();
        if (expiryError) {
            this.setState({error: expiryError});
            return;
        }

        const {eventDelivery} = this.state;
        if (this.props.eventDeliveryEnabled && eventDelivery.mode === 'push' && !eventDelivery.callbackUrl.trim()) {
            this.setState({
                error: (
                    <FormattedMessage
                        id='bot.add.event_delivery.callback_url_required'
                        defaultMessage='Enter a callback URL for push delivery.'
                    />
                ),
            });
            return;
        }

        const ready = this.attributesReady();
        const lockOptions = {canEditAdminManaged: this.props.editingUserHasManageSystem};
        const attributeErrors = ready ? validateAttributeRows(this.props.attributeFields, this.state.attributes, lockOptions) : {};
        if (Object.keys(attributeErrors).length > 0) {
            this.setState((state) => ({
                attributes: {...state.attributes, errors: attributeErrors},
                error: (
                    <FormattedMessage
                        id='bots.attributes.invalid'
                        defaultMessage='Fix the highlighted attributes before saving.'
                    />
                ),
            }));
            return;
        }

        this.submitting = true;
        this.setState((state) => ({adding: true, error: '', attributes: {...state.attributes, errors: {}}}));

        const input = {
            pictureFile: this.state.pictureFile,
            roleUpdate: this.getRoleUpdate(),
            attributeChanges: ready ? computeAttributeChanges(this.props.attributeFields, this.state.attributes, lockOptions) : {},
        };
        const bot = {
            username: this.state.username.toLowerCase().trim(),
            display_name: this.state.displayName,
            description: this.state.description,
        };

        if (this.props.bot) {
            const result = await saveBotEdit(this.props.actions, {
                ...input,
                botUserId: this.props.bot.user_id,
                patch: bot,
                eventDelivery: this.props.eventDeliveryEnabled ? planEventDeliveryChange(eventDelivery) : {kind: 'none'},
            });
            this.handleEditResult(result);
            return;
        }

        const result = await saveBotCreate(this.props.actions, {
            ...input,
            bot,
            eventSubscription: this.props.eventDeliveryEnabled ? eventDeliveryPatch(eventDelivery) : undefined,
            teamName: this.props.team.name,
            expiresAt: clampExpiresAtToMaxLifetime(this.resolveExpiresAt(), this.props.maxLifetimeDays),
        });
        if (result.ok) {
            getHistory().push(result.redirectUrl);
        } else {
            this.finishWithError(result.error);
        }
    };

    handleEditResult = (result: BotEditResult) => {
        if (!result.ok) {
            this.finishWithError(result.error);
            return;
        }
        if (this.unmounted) {
            return;
        }
        const {failures, savedAttributes, eventSecret, savedSubscription} = result;
        this.setState((state) => ({
            attributes: markAttributesSaved(state.attributes, savedAttributes),
            eventDelivery: savedSubscription === undefined ? state.eventDelivery : eventDeliveryState(savedSubscription),
        }));
        if (failures.length === 0 && eventSecret) {
            this.submitting = false;
            this.setState({eventSecret, adding: false});
            return;
        }
        if (failures.length === 0) {
            getHistory().push(`/${this.props.team.name}/integrations/bots`);
            return;
        }
        const renderFailure = ({message, error}: BotSaveFailure) => (
            <FormattedMessage
                {...message}
                values={{error}}
            />
        );
        this.finishWithError(failures.length === 1 ? renderFailure(failures[0]) : (
            <>{failures.map((failure) => <div key={failure.key}>{renderFailure(failure)}</div>)}</>
        ));
    };

    renderDefaultTokenExpiryPicker = (): JSX.Element | null => {
        if (this.props.bot) {
            return null;
        }

        return (
            <>
                <div className='row bot-profile__section'>
                    <div className='col-md-5 col-sm-8 col-sm-offset-4'>
                        <strong>
                            <FormattedMessage
                                id='bot.add.default_token.title'
                                defaultMessage='Default access token'
                            />
                        </strong>
                    </div>
                </div>
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='defaultTokenExpiry'
                    >
                        <FormattedMessage
                            id='bot.add.default_token.expiry'
                            defaultMessage='Default token expires'
                        />
                    </label>
                    <div className='col-md-5 col-sm-8'>
                        <TokenExpiryPicker
                            idPrefix='defaultToken'
                            expiryPreset={this.state.expiryPreset}
                            customExpiryDate={this.state.customExpiryDate}
                            maxLifetimeDays={this.props.maxLifetimeDays}
                            enforceExpiry={this.props.maxLifetimeDays > 0}
                            onPresetChange={this.updateExpiryPreset}
                            onCustomDateChange={this.updateCustomExpiryDate}
                            hintClassName='form__help'
                        />
                    </div>
                </div>
            </>
        );
    };

    render() {
        const canEditRoles = this.canEditRoles();
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
            <WithTooltip
                title={
                    <FormattedMessage
                        id='bot.remove_profile_picture'
                        defaultMessage='Remove Bot Icon'
                    />
                }
            >
                <a
                    className={'bot-profile__remove'}
                    onClick={this.setDefault}
                >
                    <span>{'×'}</span>
                </a>
            </WithTooltip>
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

        const header = (
            <BackstageHeader>
                <Link to={`/${this.props.team.name}/integrations/bots`}>
                    <FormattedMessage
                        id='bots.manage.header'
                        defaultMessage='Bot Accounts'
                    />
                </Link>
                {subtitle}
            </BackstageHeader>
        );

        if (this.state.eventSecret) {
            return (
                <div className='backstage-content'>
                    {header}
                    <div className='backstage-form backstage-form__confirmation'>
                        <h4 className='backstage-form__title'>
                            <FormattedMessage
                                id='integrations.successful'
                                defaultMessage='Setup Successful'
                            />
                        </h4>
                        <BotEventSecret secret={this.state.eventSecret}>
                            <div className='mt-2'>
                                <Link
                                    className={buttonClassNames({emphasis: 'primary'})}
                                    to={`/${this.props.team.name}/integrations/bots`}
                                >
                                    <FormattedMessage
                                        id='integrations.done'
                                        defaultMessage='Done'
                                    />
                                </Link>
                            </div>
                        </BotEventSecret>
                    </div>
                </div>
            );
        }

        return (
            <div className='backstage-content'>
                {header}
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
                                    className={buttonClassNames({emphasis: 'primary'}, 'btn-file')}
                                >
                                    <FormattedMessage
                                        id='bots.image.upload'
                                        defaultMessage='Upload Image'
                                    />
                                    <input
                                        className='btn-file__input'
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
                                    disabled={!canEditRoles}
                                    onChange={this.updateRole}
                                >
                                    <option
                                        value={roleOptionMember}
                                    >
                                        {Utils.localizeMessage({id: 'bot.add.role.member', defaultMessage: 'Member'})}
                                    </option>
                                    <option
                                        value={roleOptionSystemAdmin}
                                    >
                                        {Utils.localizeMessage({id: 'bot.add.role.admin', defaultMessage: 'System Admin'})}
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
                        {this.props.attributesEnabled && (
                            <BotAttributesSection
                                fields={this.props.attributeFields}
                                state={this.state.attributes}
                                disabled={this.state.adding}
                                canEditAdminManaged={this.props.editingUserHasManageSystem}
                                onAdd={this.addAttributeRow}
                                onRemove={this.removeAttributeRow}
                                onChange={this.updateAttributeValue}
                                onRetry={this.retryAttributes}
                            />
                        )}
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
                            <div className='col-md-5 col-sm-8'>
                                <Checkbox
                                    id='postAll'
                                    className='backstage-form__checkbox'
                                    checked={this.state.postAll || this.state.role === roleOptionSystemAdmin}
                                    onChange={this.updatePostAll}
                                    disabled={!canEditRoles || this.state.role === roleOptionSystemAdmin}
                                >
                                    <FormattedMessage
                                        id='bot.add.post_all.enabled'
                                        defaultMessage='Enabled'
                                    />
                                </Checkbox>
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
                            <div className='col-md-5 col-sm-8'>
                                <Checkbox
                                    id='postChannels'
                                    className='backstage-form__checkbox'
                                    checked={this.state.postChannels || this.state.role === roleOptionSystemAdmin || this.state.postAll}
                                    onChange={this.updatePostChannels}
                                    disabled={!canEditRoles || this.state.role === roleOptionSystemAdmin || this.state.postAll}
                                >
                                    <FormattedMessage
                                        id='bot.add.post_channels.enabled'
                                        defaultMessage='Enabled'
                                    />
                                </Checkbox>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='bot.add.post_channels.help'
                                        defaultMessage='Bot will have access to post to all Mattermost public channels.'
                                    />
                                </div>
                            </div>
                        </div>
                        {this.props.eventDeliveryEnabled && (
                            <BotEventDeliverySection
                                state={this.state.eventDelivery}
                                disabled={this.state.adding}
                                onChange={this.updateEventDelivery}
                            />
                        )}
                        {this.renderDefaultTokenExpiryPicker()}
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                errors={[this.state.error]}
                            />
                            <Link
                                className={buttonClassNames({emphasis: 'tertiary'})}
                                to={`/${this.props.team.name}/integrations/bots`}
                            >
                                <FormattedMessage
                                    id='bots.manage.add.cancel'
                                    defaultMessage='Cancel'
                                />
                            </Link>
                            <SpinnerButton
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
