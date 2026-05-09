// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Board} from '@mattermost/types/boards';
import type {ChannelType, Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {setNewChannelWithBoardPreference} from 'mattermost-redux/actions/boards';
import {createChannel} from 'mattermost-redux/actions/channels';
import {Client4} from 'mattermost-redux/client';
import Permissions from 'mattermost-redux/constants/permissions';
import Preferences from 'mattermost-redux/constants/preferences';
import {areManagedCategoriesEnabled} from 'mattermost-redux/selectors/entities/channel_categories';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {switchToChannel} from 'actions/views/channel';
import {closeModal} from 'actions/views/modals';

import {ColorSwatch, LevelOptionLabel} from 'components/admin_console/classification_markings/classification_markings_styled';
import {
    CHANNEL_LINKED_OBJECT_TYPE,
    GROUP_NAME,
} from 'components/admin_console/classification_markings/utils';
import {classificationPresetDropdownStyles} from 'components/admin_console/classification_markings/utils/preset_dropdown_styles';
import ChannelNameFormField from 'components/channel_name_form_field/channel_name_form_field';
import {
    CHANNEL_BANNER_MAX_CHARACTER_LIMIT,
    CHANNEL_BANNER_MIN_CHARACTER_LIMIT,
} from 'components/channel_settings_modal/channel_settings_configuration_tab';
import ManagedCategorySelector from 'components/channel_settings_modal/managed_category_selector';
import useClassificationMarkings from 'components/common/hooks/useClassificationMarkings';
import DropdownInput from 'components/dropdown_input';
import type {ValueType} from 'components/dropdown_input';
import type {TextboxElement} from 'components/textbox';
import Toggle from 'components/toggle';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';
import Input from 'components/widgets/inputs/input/input';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';
import WithTooltip from 'components/with_tooltip';

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

const enum ServerErrorId {
    CHANNEL_URL_SIZE = 'model.channel.is_valid.1_or_more.app_error',
    CHANNEL_UPDATE_EXISTS = 'store.sql_channel.update.exists.app_error',
    CHANNEL_CREATE_EXISTS = 'store.sql_channel.save_channel.exists.app_error',
    CHANNEL_PURPOSE_SIZE = 'model.channel.is_valid.purpose.app_error',
}

const NewChannelModal = () => {
    const intl = useIntl();
    const {formatMessage} = intl;

    const currentTeamId = useSelector(getCurrentTeam)?.id;

    const canCreatePublicChannel = useSelector((state: GlobalState) => (currentTeamId ? haveICurrentChannelPermission(state, Permissions.CREATE_PUBLIC_CHANNEL) : false));
    const canCreatePrivateChannel = useSelector((state: GlobalState) => (currentTeamId ? haveICurrentChannelPermission(state, Permissions.CREATE_PRIVATE_CHANNEL) : false));
    const enableManagedCategories = useSelector(areManagedCategoriesEnabled);
    const dispatch = useDispatch();

    const [type, setType] = useState(getChannelTypeFromPermissions(canCreatePublicChannel, canCreatePrivateChannel));
    const [displayName, setDisplayName] = useState('');
    const [url, setURL] = useState('');
    const [purpose, setPurpose] = useState('');
    const [urlError, setURLError] = useState('');
    const [purposeError, setPurposeError] = useState('');
    const [serverError, setServerError] = useState('');
    const [channelInputError, setChannelInputError] = useState(false);
    const [managedCategoryName, setManagedCategoryName] = useState<string | undefined>(undefined);

    const classification = useClassificationMarkings();
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

    const handleURLChange = useCallback((newURL: string) => {
        setURL(newURL);
        setURLError('');
    }, []);

    const handleOnModalConfirm = async () => {
        if (!canCreate || !currentTeamId) {
            return;
        }

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
            managed_category_name: managedCategoryName,
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
                        GROUP_NAME,
                        CHANNEL_LINKED_OBJECT_TYPE,
                        newChannel!.id,
                        [{field_id: classification.channelField.id, value: {classification_id: selectedClassificationId, banner_text: bannerText}}],
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
            onCreateChannelError({message: formatMessage({id: 'channel_modal.error.generic', defaultMessage: 'Something went wrong. Please try again.'})});
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

    const handleOnTypeChange = useCallback((channelType: ChannelType) => {
        setType(channelType);
        setServerError('');
    }, []);

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

    const classificationValid = !classificationEnabled || (Boolean(selectedClassificationId) && bannerText.trim().length > 0);
    const canCreate = displayName && !urlError && type && !purposeError && !serverError && canCreateFromPluggable && !channelInputError && classificationValid;

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

    return (
        <GenericModal
            id='new-channel-modal'
            className='new-channel-modal'
            modalHeaderText={formatMessage({id: 'channel_modal.modalTitle', defaultMessage: 'Create a new channel'})}
            confirmButtonText={formatMessage({id: 'channel_modal.createNew', defaultMessage: 'Create channel'})}
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
                    onChange={handleOnTypeChange}
                />
                {enableManagedCategories && (
                    <div className='new-channel-modal-managed-category'>
                        <ManagedCategorySelector
                            value={managedCategoryName}
                            onChange={setManagedCategoryName}
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
                    {createBoardFromChannelPlugin &&
                        <Pluggable
                            pluggableName='CreateBoardFromTemplate'
                            setCanCreate={setCanCreateFromPluggable}
                            setAction={setActionFromPluggable}
                            newBoardInfoIcon={newBoardInfoIcon}
                        />
                    }
                </div>
                {classification.available && (
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
                                    <label className='new-channel-modal-classification__field-label'>
                                        <FormattedMessage
                                            id='channel_modal.classification.level_label'
                                            defaultMessage='Classification level'
                                        />
                                    </label>
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
                                        <label className='new-channel-modal-classification__field-label'>
                                            <FormattedMessage
                                                id='channel_modal.classification.banner_label'
                                                defaultMessage='Banner text'
                                            />
                                        </label>
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
            </div>
        </GenericModal>
    );
};

export default NewChannelModal;
