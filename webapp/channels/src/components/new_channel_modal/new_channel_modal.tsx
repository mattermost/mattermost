// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Board} from '@mattermost/types/boards';
import type {ChannelType, Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {NewChannelFormResult, NewChannelFormState} from '@mattermost/types/plugins';

import {setNewChannelWithBoardPreference} from 'mattermost-redux/actions/boards';
import {createChannel} from 'mattermost-redux/actions/channels';
import {Client4} from 'mattermost-redux/client';
import Permissions from 'mattermost-redux/constants/permissions';
import Preferences from 'mattermost-redux/constants/preferences';
import {areManagedCategoriesEnabled, isChannelCategorySortingEnabled, makeGetSidebarCategoryNamesForTeam} from 'mattermost-redux/selectors/entities/channel_categories';
import {isDiscoverableChannelsEnabled} from 'mattermost-redux/selectors/entities/general';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentChannelPermission, haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {switchToChannel} from 'actions/views/channel';
import {closeModal} from 'actions/views/modals';

import {ColorSwatch, LevelOptionLabel} from 'components/admin_console/classification_markings/classification_markings_styled';
import {
    CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
    CLASSIFICATIONS_GROUP_NAME,
} from 'components/admin_console/classification_markings/utils';
import {classificationPresetDropdownStyles} from 'components/admin_console/classification_markings/utils/preset_dropdown_styles';
import CategorySelector from 'components/category_selector/category_selector';
import ChannelNameFormField from 'components/channel_name_form_field/channel_name_form_field';
import {
    CHANNEL_BANNER_MAX_CHARACTER_LIMIT,
    CHANNEL_BANNER_MIN_CHARACTER_LIMIT,
} from 'components/channel_settings_modal/channel_settings_configuration_tab';
import useClassificationMarkings from 'components/common/hooks/useClassificationMarkings';
import DropdownInput from 'components/dropdown_input';
import type {ValueType} from 'components/dropdown_input';
import type {TextboxElement} from 'components/textbox';
import Toggle from 'components/toggle';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';
import Input from 'components/widgets/inputs/input/input';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';
import type {PluginOptionButtonProps} from 'components/widgets/public-private-selector/public-private-selector';

import Pluggable from 'plugins/pluggable';
import Constants, {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './new_channel_modal.scss';

export function getChannelTypeFromPermissions(canCreatePublicChannel: boolean, canCreatePrivateChannel: boolean) {
    let channelType = Constants.OPEN_CHANNEL;

    if (!canCreatePublicChannel && channelType === Constants.OPEN_CHANNEL) {
        channelType = Constants.PRIVATE_CHANNEL as ChannelType;
    }

    if (!canCreatePrivateChannel && channelType === Constants.PRIVATE_CHANNEL) {
        channelType = Constants.OPEN_CHANNEL as ChannelType;
    }

    return channelType as ChannelType;
}

function isBuiltInType(t: string): t is ChannelType {
    return t === Constants.OPEN_CHANNEL || t === Constants.PRIVATE_CHANNEL;
}

const enum ServerErrorId {
    CHANNEL_URL_SIZE = 'model.channel.is_valid.1_or_more.app_error',
    CHANNEL_UPDATE_EXISTS = 'store.sql_channel.update.exists.app_error',
    CHANNEL_CREATE_EXISTS = 'store.sql_channel.save_channel.exists.app_error',
    CHANNEL_PURPOSE_SIZE = 'model.channel.is_valid.purpose.app_error',
}

const NewChannelModal = () => {
    const intl = useIntl();
    const {formatMessage} = intl;

    const getSidebarCategoryNamesForTeam = useRef(makeGetSidebarCategoryNamesForTeam());

    const currentTeamId = useSelector(getCurrentTeam)?.id;

    const canCreatePublicChannel = useSelector((state: GlobalState) => (currentTeamId ? haveICurrentChannelPermission(state, Permissions.CREATE_PUBLIC_CHANNEL) : false));
    const canCreatePrivateChannel = useSelector((state: GlobalState) => (currentTeamId ? haveICurrentChannelPermission(state, Permissions.CREATE_PRIVATE_CHANNEL) : false));
    const showDefaultCategorySelector = useSelector(isChannelCategorySortingEnabled);
    const showManagedCategorySelector = useSelector(areManagedCategoriesEnabled);
    const dispatch = useDispatch();

    const [type, setType] = useState<string>(getChannelTypeFromPermissions(canCreatePublicChannel, canCreatePrivateChannel));

    // Discoverable Private Channels — only available when the FF is on AND the
    // creator has the team-scope discoverability permission (the server
    // applies the same check on createChannel with discoverable=true). The
    // toggle is hidden entirely otherwise so a user without permission
    // doesn't see a control they can't exercise.
    const discoverableFeatureEnabled = useSelector(isDiscoverableChannelsEnabled);
    const canCreateDiscoverableChannel = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_PRIVATE_CHANNEL_DISCOVERABILITY));
    const showDiscoverableOption = discoverableFeatureEnabled && canCreateDiscoverableChannel && type === Constants.PRIVATE_CHANNEL;
    const [discoverable, setDiscoverable] = useState(false);
    const discoverableTitle = formatMessage({
        id: 'channel_settings.discoverable.title',
        defaultMessage: 'Discoverable (Users can request to join)',
    });
    const discoverableDescription = formatMessage({
        id: 'channel_settings.discoverable.description',
        defaultMessage: 'Non-members can see this channel in Browse Channels, the channel switcher, and shared permalinks. Message contents stay hidden until they join.',
    });
    const [displayName, setDisplayName] = useState('');
    const [url, setURL] = useState('');
    const [purpose, setPurpose] = useState('');
    const [urlError, setURLError] = useState('');
    const [purposeError, setPurposeError] = useState('');
    const [serverError, setServerError] = useState('');
    const [channelInputError, setChannelInputError] = useState(false);
    const [defaultCategoryName, setDefaultCategoryName] = useState<string | undefined>(undefined);
    const [managedCategoryName, setManagedCategoryName] = useState<string | undefined>(undefined);

    const classification = useClassificationMarkings();
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);
    const canManageClassification = classification.available && isSystemAdmin;
    const [classificationEnabled, setClassificationEnabled] = useState(false);
    const [selectedClassificationId, setSelectedClassificationId] = useState('');
    const [bannerText, setBannerText] = useState('');
    const [bannerTextPreview, setBannerTextPreview] = useState(false);

    const classificationOptions = useMemo(() => {
        return classification.levels.
            filter((l) => l.name.trim() !== '').
            map((l) => ({value: l.id, label: l.name.trim(), color: l.color}));
    }, [classification.levels]);

    const selectedClassificationOption = useMemo((): ValueType | undefined => {
        return classificationOptions.find((o) => o.value === selectedClassificationId);
    }, [classificationOptions, selectedClassificationId]);

    const selectedClassificationLevel = useMemo(() => {
        return classification.levels.find((l) => l.id === selectedClassificationId);
    }, [classification.levels, selectedClassificationId]);

    const handleClassificationLevelChange = useCallback((selected: ValueType) => {
        setSelectedClassificationId(selected.value);
        const level = classification.levels.find((l) => l.id === selected.value);
        if (level) {
            setBannerText(`**${level.name}**`);
        }
    }, [classification.levels]);

    const formatClassificationOptionLabel = useCallback((option: ValueType) => {
        const levelOption = option as ValueType & {color: string};
        return (
            <LevelOptionLabel>
                <ColorSwatch style={{backgroundColor: levelOption.color}}/>
                <span>{levelOption.label}</span>
            </LevelOptionLabel>
        );
    }, []);

    // create a board along with the channel
    const createBoardFromChannelPlugin = useSelector((state: GlobalState) => state.plugins.components.CreateBoardFromTemplate);
    const newChannelWithBoardPulsatingDotState = useSelector((state: GlobalState) => getPreference(state, Preferences.APP_BAR, Preferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED, ''));

    const [canCreateFromPluggable, setCanCreateFromPluggable] = useState(true);
    const [actionFromPluggable, setActionFromPluggable] = useState<((currentTeamId: string, channelId: string) => Promise<Board>) | undefined>(undefined);
    const [pluginCanCreate, setPluginCanCreate] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const availableOptions = useSelector(
        (state: GlobalState) => (state.plugins.components.ChannelTypeOption || []).filter((o) => {
            try {
                return o.isAvailable(state);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error(`ChannelTypeOption ${o.pluginId}:${o.id} isAvailable threw`, e);
                return false;
            }
        }),
        shallowEqual,
    );

    const activePluginOption = availableOptions.find((o) => o.id === type);

    const handleURLChange = useCallback((newURL: string) => {
        setURL(newURL);
        setURLError('');
    }, []);

    const handleOnModalConfirm = async () => {
        if (!canCreate || !currentTeamId) {
            return;
        }

        if (isBuiltInType(type)) {
            const channel: Channel = {
                team_id: currentTeamId,
                name: url,
                display_name: displayName,
                purpose,
                header: '',
                type,
                create_at: 0,
                creator_id: '',
                delete_at: 0,
                group_constrained: false,
                id: '',
                last_post_at: 0,
                last_root_post_at: 0,
                scheme_id: '',
                update_at: 0,
                default_category_name: defaultCategoryName,
                managed_category_name: managedCategoryName,

                // Only send `discoverable: true` when the toggle is actually
                // rendered (private + FF on + has permission) AND the user
                // checked it. The server rejects discoverable=true on a public
                // channel; we never include the field for OPEN_CHANNEL.
                ...(showDiscoverableOption && discoverable ? {discoverable: true} : {}),
                ...(classificationEnabled && selectedClassificationId && bannerText ? {

                    // Leave banner_info disabled: the classification banner renders
                    // off the property value, not banner_info.enabled.
                    banner_info: {
                        enabled: true,
                        text: bannerText,
                        background_color: selectedClassificationLevel?.color || '',
                    },
                } : {}),
            };

            try {
                const {data: newChannel, error} = await dispatch(createChannel(channel, ''));
                if (error) {
                    onCreateChannelError(error);
                    return;
                }

                if (classificationEnabled && selectedClassificationId && classification.channelField && bannerText) {
                    try {
                        await Client4.patchPropertyValues(
                            CLASSIFICATIONS_GROUP_NAME,
                            CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
                            newChannel!.id,
                            [{field_id: classification.channelField.id, value: selectedClassificationId}],
                        );
                    } catch {
                        // Classification save failure should not block channel creation
                    }
                }

                handleOnModalCancel();

                // If template selected, create a new board from this template
                if (canCreateFromPluggable && createBoardFromChannelPlugin) {
                    try {
                        addBoardToChannel(newChannel!.id);
                    } catch (e: any) {
                        // eslint-disable-next-line no-console
                        console.log(e.message);
                    }
                }
                dispatch(switchToChannel(newChannel!));
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('NewChannelModal builtin creation failed', e);
                onCreateChannelError({message: formatMessage({id: 'channel_modal.error.generic', defaultMessage: 'Something went wrong. Please try again.'})});
            }
        } else if (activePluginOption) {
            const genericError = formatMessage({id: 'channel_modal.error.generic', defaultMessage: 'Something went wrong. Please try again.'});
            setIsSubmitting(true);
            let result: NewChannelFormResult | undefined;
            try {
                result = await activePluginOption.onCreate(formState);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error(`ChannelTypeOption ${activePluginOption.pluginId}:${activePluginOption.id} onCreate threw`, e);
                setServerError(genericError);
            } finally {
                setIsSubmitting(false);
            }
            if (!result || typeof result !== 'object') {
                return;
            }
            if (result.status === 'created' && !result.channel) {
                // eslint-disable-next-line no-console
                console.error(`ChannelTypeOption ${activePluginOption.pluginId}:${activePluginOption.id} returned malformed result`, result);
                setServerError(genericError);
                return;
            }
            if (result.status === 'error' && typeof result.message !== 'string') {
                // eslint-disable-next-line no-console
                console.error(`ChannelTypeOption ${activePluginOption.pluginId}:${activePluginOption.id} returned malformed result`, result);
                setServerError(genericError);
                return;
            }
            switch (result.status) {
            case 'created':
                dispatch(switchToChannel(result.channel));
                handleOnModalCancel();
                break;
            case 'deferred':
                handleOnModalCancel();
                break;
            case 'error':
                setServerError(result.message);
                break;
            default:
                // eslint-disable-next-line no-console
                console.error(`ChannelTypeOption ${activePluginOption.pluginId}:${activePluginOption.id} returned unrecognized status`, result);
                setServerError(genericError);
            }
        }
    };

    const addBoardToChannel = async (channelId: string) => {
        if (!createBoardFromChannelPlugin || !currentTeamId) {
            return false;
        }
        if (!actionFromPluggable) {
            return false;
        }

        const action = actionFromPluggable as (currentTeamId: string, channelId: string) => Promise<Board>;
        if (action && canCreateFromPluggable) {
            const board = await action(channelId, currentTeamId);

            if (!board?.id) {
                return false;
            }
        }

        // show the new channel with board tour tip
        if (newChannelWithBoardPulsatingDotState === '') {
            dispatch(setNewChannelWithBoardPreference({[Preferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED]: false}));
        }
        return true;
    };

    const handleOnModalCancel = () => {
        dispatch(closeModal(ModalIdentifiers.NEW_CHANNEL_MODAL));
    };

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const onCreateChannelError = ({server_error_id, message}: ServerError) => {
        switch (server_error_id) {
        case ServerErrorId.CHANNEL_URL_SIZE:
            setURLError(
                formatMessage({
                    id: 'channel_modal.handleTooShort',
                    defaultMessage: 'Channel URL must be 1 or more lowercase alphanumeric characters',
                }),
            );
            break;

        case ServerErrorId.CHANNEL_UPDATE_EXISTS:
        case ServerErrorId.CHANNEL_CREATE_EXISTS:
            setURLError(
                formatMessage({
                    id: 'channel_modal.alreadyExist',
                    defaultMessage: 'A channel with that URL already exists',
                }),
            );
            break;

        case ServerErrorId.CHANNEL_PURPOSE_SIZE:
            setPurposeError(
                formatMessage({
                    id: 'channel_modal.purposeTooLong',
                    defaultMessage: 'The purpose exceeds the maximum of 250 characters',
                }),
            );
            break;

        default:
            setServerError(message);
            break;
        }
    };

    const handleOnTypeChange = useCallback((channelType: string) => {
        if (isSubmitting) {
            return;
        }
        setType(channelType);
        setServerError('');
        setPluginCanCreate(true);
    }, [isSubmitting]);

    const handleOnPurposeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const {target: {value: purpose}} = e;

        setPurpose(purpose);
        setPurposeError('');
        setServerError('');
    };

    const handleOnPurposeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Avoid firing the handleEnterKeyPress in GenericModal from purpose textarea
        e.stopPropagation();
    };

    const hasValidType = isBuiltInType(type) || Boolean(activePluginOption);
    const pluginCreateGate = isBuiltInType(type) ? canCreateFromPluggable : pluginCanCreate;
    const classificationValid = !classificationEnabled || (Boolean(selectedClassificationId) && bannerText.trim().length > 0);
    const canCreate = displayName && !urlError && hasValidType && !purposeError && !serverError && pluginCreateGate && !channelInputError && classificationValid && !isSubmitting;

    const pluginOptions = useMemo<PluginOptionButtonProps[]>(() => availableOptions.map((o) => ({
        id: o.id,
        label: o.label,
        description: o.description,
        icon: o.icon,
    })), [availableOptions]);

    const formState = useMemo<NewChannelFormState>(() => ({
        teamId: currentTeamId ?? '',
        displayName,
        url,
        purpose,
        type,
        managedCategoryName,
    }), [currentTeamId, displayName, url, purpose, type, managedCategoryName]);

    const newBoardInfoIcon = (
        <WithTooltip
            title={
                <>
                    <div className='title'>
                        <FormattedMessage
                            id={'channel_modal.create_board.tooltip_title'}
                            defaultMessage={'Manage your task with a board'}
                        />
                    </div>
                    <div className='description'>
                        <FormattedMessage
                            id={'channel_modal.create_board.tooltip_description'}
                            defaultMessage={'Use any of our templates to manage your tasks or start from scratch with your own!'}
                        />
                    </div>
                </>
            }
        >
            <i className='icon-information-outline'/>
        </WithTooltip>
    );

    const confirmButtonText = isSubmitting ? (
        <LoadingSpinner
            text={formatMessage({id: 'channel_modal.creating', defaultMessage: 'Creating...'})}
        />
    ) : (activePluginOption?.createButtonText ?? formatMessage({id: 'channel_modal.createNew', defaultMessage: 'Create channel'}));

    return (
        <GenericModal
            id='new-channel-modal'
            className='new-channel-modal'
            modalHeaderText={formatMessage({id: 'channel_modal.modalTitle', defaultMessage: 'Create a new channel'})}
            confirmButtonText={confirmButtonText}
            cancelButtonText={formatMessage({id: 'channel_modal.cancel', defaultMessage: 'Cancel'})}
            errorText={serverError}
            isConfirmDisabled={!canCreate}
            autoCloseOnConfirmButton={false}
            compassDesign={true}
            handleConfirm={handleOnModalConfirm}
            handleEnterKeyPress={handleOnModalConfirm}
            handleCancel={handleOnModalCancel}
            onExited={handleOnModalCancel}
        >
            <div className='new-channel-modal-body'>
                <ChannelNameFormField
                    value={displayName}
                    name='new-channel-modal-name'
                    placeholder={formatMessage({id: 'channel_modal.name.placeholder', defaultMessage: 'Enter a name for your new channel'})}
                    onDisplayNameChange={setDisplayName}
                    onURLChange={handleURLChange}
                    onErrorStateChange={setChannelInputError}
                    urlError={urlError}
                />
                <PublicPrivateSelector
                    className='new-channel-modal-type-selector'
                    selected={type}
                    publicButtonProps={{
                        title: formatMessage({id: 'channel_modal.type.public.title', defaultMessage: 'Public Channel'}),
                        description: formatMessage({id: 'channel_modal.type.public.description', defaultMessage: 'Anyone can join'}),
                        disabled: !canCreatePublicChannel,
                    }}
                    privateButtonProps={{
                        title: formatMessage({id: 'channel_modal.type.private.title', defaultMessage: 'Private Channel'}),
                        description: formatMessage({id: 'channel_modal.type.private.description', defaultMessage: 'Only invited members'}),
                        disabled: !canCreatePrivateChannel,
                    }}
                    pluginOptions={pluginOptions}
                    onChange={handleOnTypeChange}
                />
                {showDiscoverableOption && (
                    <div
                        className='new-channel-modal-discoverable'
                        data-testid='new-channel-discoverable-section'
                    >
                        <div className='channel_banner_header'>
                            <div className='channel_banner_header__text'>
                                <label
                                    className='Input_legend'
                                    aria-label={discoverableTitle}
                                >
                                    {discoverableTitle}
                                </label>
                                <label
                                    className='Input_subheading'
                                    aria-label={discoverableTitle}
                                >
                                    {discoverableDescription}
                                </label>
                            </div>
                            <div className='channel_banner_header__toggle'>
                                <Toggle
                                    id='newChannelDiscoverableToggle'
                                    overrideTestId={true}
                                    ariaLabel={discoverableTitle}
                                    size='btn-md'
                                    toggled={discoverable}
                                    onToggle={() => setDiscoverable((v) => !v)}
                                    tabIndex={0}
                                    toggleClassName='btn-toggle-primary'
                                />
                            </div>
                        </div>
                    </div>
                )}
                {showDefaultCategorySelector && (
                    <div className='new-channel-modal-managed-category'>
                        <CategorySelector
                            value={defaultCategoryName}
                            onChange={setDefaultCategoryName}
                            getOptions={getSidebarCategoryNamesForTeam.current}
                            menuPortalTargetId='new-channel-modal'
                            helpText={formatMessage({id: 'default_category.help_text', defaultMessage: 'Sets the default sidebar category for users when they join the channel.'})}
                        />
                    </div>
                )}
                {showManagedCategorySelector && (
                    <div className='new-channel-modal-managed-category'>
                        <CategorySelector
                            value={managedCategoryName}
                            onChange={setManagedCategoryName}
                            getOptions={getSidebarCategoryNamesForTeam.current}
                            label={formatMessage({id: 'managed_category.label', defaultMessage: 'Managed category (optional)'})}
                            placeholder={formatMessage({id: 'managed_category.placeholder', defaultMessage: 'Choose a managed category (optional)'})}
                            menuPortalTargetId='new-channel-modal'
                        />
                    </div>
                )}
                <div className='new-channel-modal-purpose-container'>
                    <Input
                        id='new-channel-modal-purpose'
                        type='textarea'
                        value={purpose}
                        onChange={handleOnPurposeChange}
                        onKeyDown={handleOnPurposeKeyDown}
                        label={formatMessage({id: 'channel_modal.purpose.label', defaultMessage: 'Channel Purpose'})}
                        placeholder={formatMessage({id: 'channel_modal.purpose.placeholder', defaultMessage: 'Enter a purpose for this channel (optional)'})}
                        maxLength={Constants.MAX_CHANNELPURPOSE_LENGTH}
                        autoComplete='off'
                        className={classNames('new-channel-modal-purpose-textarea', {'with-error': purposeError})}
                        rows={4}
                    />
                    {purposeError ? (
                        <div className='new-channel-modal-purpose-error'>
                            <i className='icon icon-alert-outline'/>
                            <span>{purposeError}</span>
                        </div>
                    ) : (
                        <div className='new-channel-modal-purpose-info'>
                            <span>
                                {formatMessage({id: 'channel_modal.purpose.info', defaultMessage: 'This will be displayed when browsing for channels.'})}
                            </span>
                        </div>
                    )}
                    {createBoardFromChannelPlugin && isBuiltInType(type) &&
                        <Pluggable
                            pluggableName='CreateBoardFromTemplate'
                            setCanCreate={setCanCreateFromPluggable}
                            setAction={setActionFromPluggable}
                            newBoardInfoIcon={newBoardInfoIcon}
                        />
                    }
                </div>
                {canManageClassification && (
                    <div className='new-channel-modal-classification'>
                        <div className='new-channel-modal-classification__header'>
                            <div className='new-channel-modal-classification__header-text'>
                                <h4>
                                    <FormattedMessage
                                        id='channel_modal.classification.toggle_label'
                                        defaultMessage='Channel classification'
                                    />
                                </h4>
                            </div>
                            <Toggle
                                id='channelClassificationToggle'
                                toggled={classificationEnabled}
                                onToggle={() => setClassificationEnabled(!classificationEnabled)}
                                toggleClassName='btn-toggle-primary'
                                size='btn-md'
                                ariaLabel={formatMessage({id: 'channel_modal.classification.toggle_label', defaultMessage: 'Channel classification'})}
                            />
                        </div>
                        <p className='new-channel-modal-classification__description'>
                            <FormattedMessage
                                id='channel_modal.classification.toggle_description'
                                defaultMessage='When enabled, classification markings will appear for this channel. Individual channels cannot have a classification level lower than the global classification level.'
                            />
                        </p>
                        {classificationEnabled && (
                            <div className='new-channel-modal-classification__fields'>
                                <div className='new-channel-modal-classification__field-row'>
                                    <span className='new-channel-modal-classification__field-label'>
                                        <FormattedMessage
                                            id='channel_modal.classification.level_label'
                                            defaultMessage='Classification level'
                                        />
                                    </span>
                                    <div className='new-channel-modal-classification__field-input'>
                                        <DropdownInput
                                            className='new-channel-modal-classification__level-dropdown'
                                            name='channelClassificationLevel'
                                            testId='channelClassificationLevel'
                                            options={classificationOptions}
                                            value={selectedClassificationOption}
                                            onChange={handleClassificationLevelChange}
                                            isClearable={false}
                                            required={true}
                                            styles={classificationPresetDropdownStyles}
                                            formatOptionLabel={formatClassificationOptionLabel}
                                            menuPortalTarget={document.body}
                                        />
                                    </div>
                                </div>
                                {selectedClassificationLevel && (
                                    <div className='new-channel-modal-classification__field-row'>
                                        <span className='new-channel-modal-classification__field-label'>
                                            <FormattedMessage
                                                id='channel_modal.classification.banner_label'
                                                defaultMessage='Banner text'
                                            />
                                        </span>
                                        <div className='new-channel-modal-classification__field-input'>
                                            <AdvancedTextbox
                                                id='channel_classification_banner_text'
                                                value={bannerText}
                                                channelId=''
                                                onKeyPress={() => {}}
                                                useChannelMentions={false}
                                                onChange={(e: React.ChangeEvent<TextboxElement>) => setBannerText(e.target.value)}
                                                preview={bannerTextPreview}
                                                togglePreview={() => setBannerTextPreview(!bannerTextPreview)}
                                                createMessage={formatMessage({id: 'channel_modal.classification.banner_placeholder', defaultMessage: 'Banner text'})}
                                                maxLength={CHANNEL_BANNER_MAX_CHARACTER_LIMIT}
                                                minLength={CHANNEL_BANNER_MIN_CHARACTER_LIMIT}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {activePluginOption?.extraContent && (
                    <activePluginOption.extraContent
                        formState={formState}
                        setCanCreate={setPluginCanCreate}
                    />
                )}
            </div>
        </GenericModal>
    );
};

export default NewChannelModal;
