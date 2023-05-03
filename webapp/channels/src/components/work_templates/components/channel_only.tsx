// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled, {createGlobalStyle} from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';
import {Tooltip} from 'react-bootstrap';

import Pluggable from 'plugins/pluggable';

import {createChannel} from 'mattermost-redux/actions/channels';
import Permissions from 'mattermost-redux/constants/permissions';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import ReduxPreferences from 'mattermost-redux/constants/preferences';
import {setNewChannelWithBoardPreference} from 'mattermost-redux/actions/boards';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {Board} from '@mattermost/types/boards';
import {ChannelType, Channel} from '@mattermost/types/channels';
import {ServerError} from '@mattermost/types/errors';

import {switchToChannel} from 'actions/views/channel';
import {closeModal} from 'actions/views/modals';

import {GlobalState} from 'types/store';

import Constants, {ItemStatus, ModalIdentifiers, Preferences, Touched} from 'utils/constants';
import {cleanUpUrlable, validateChannelUrl, getSiteURL} from 'utils/url';
import {localizeMessage} from 'utils/utils';

import usePreference from 'components/common/hooks/usePreference';
import OverlayTrigger from 'components/overlay_trigger';
import Input from 'components/widgets/inputs/input/input';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';
import URLInput from 'components/widgets/inputs/url_input/url_input';

import {overlayScrollbarAllowance} from '../constants';
import Aside from './aside';
import ChannelOnlyFooter from './channel_only_footer';

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

export function validateDisplayName(displayName: string) {
    const errors: string[] = [];

    if (displayName.length < Constants.MIN_CHANNELNAME_LENGTH) {
        errors.push(localizeMessage('channel_modal.name.longer', 'Channel names must have at least 2 characters.'));
    }

    if (displayName.length > Constants.MAX_CHANNELNAME_LENGTH) {
        errors.push(localizeMessage('channel_modal.name.shorter', 'Channel names must have maximum 64 characters.'));
    }

    return errors;
}

const enum ServerErrorId {
    CHANNEL_URL_SIZE = 'model.channel.is_valid.1_or_more.app_error',
    CHANNEL_UPDATE_EXISTS = 'store.sql_channel.update.exists.app_error',
    CHANNEL_CREATE_EXISTS = 'store.sql_channel.save_channel.exists.app_error',
    CHANNEL_PURPOSE_SIZE = 'model.channel.is_valid.purpose.app_error',
}
interface Props {
    tryTemplates: () => void;

    // component does not need any of the external actions
    manager: ReturnType<typeof useChannelOnlyManager>;
    workTemplatesEnabled: boolean;
}

export function useChannelOnlyManager() {
    const intl = useIntl();
    const {formatMessage} = intl;
    const currentTeamId = useSelector(getCurrentTeam).id;

    const canCreatePublicChannel = useSelector((state: GlobalState) => (currentTeamId ? haveICurrentChannelPermission(state, Permissions.CREATE_PUBLIC_CHANNEL) : false));
    const canCreatePrivateChannel = useSelector((state: GlobalState) => (currentTeamId ? haveICurrentChannelPermission(state, Permissions.CREATE_PRIVATE_CHANNEL) : false));
    const dispatch = useDispatch<DispatchFunc>();

    const [type, setType] = useState(getChannelTypeFromPermissions(canCreatePublicChannel, canCreatePrivateChannel));
    const [displayName, setDisplayName] = useState('');
    const [url, setURL] = useState('');
    const [purpose, setPurpose] = useState('');
    const [displayNameModified, setDisplayNameModified] = useState(false);
    const [urlModified, setURLModified] = useState(false);
    const [displayNameError, setDisplayNameError] = useState('');
    const [urlError, setURLError] = useState('');
    const [purposeError, setPurposeError] = useState('');
    const [serverError, setServerError] = useState('');

    // create a board along with the channel
    const pluginsComponentsList = useSelector((state: GlobalState) => state.plugins.components);
    const createBoardFromChannelPlugin = pluginsComponentsList?.CreateBoardFromTemplate;
    const newChannelWithBoardPulsatingDotState = useSelector((state: GlobalState) => getPreference(state, ReduxPreferences.APP_BAR, ReduxPreferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED, ''));

    const [canCreateFromPluggable, setCanCreateFromPluggable] = useState(true);
    const [actionFromPluggable, setActionFromPluggable] = useState<((currentTeamId: string, channelId: string) => Promise<Board>) | undefined>(undefined);

    const handleOnModalConfirm = async () => {
        if (!canCreate) {
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
        };

        try {
            const {data: newChannel, error} = await dispatch(createChannel(channel, ''));
            if (error) {
                onCreateChannelError(error);
                return;
            }

            dispatch(closeModal(ModalIdentifiers.WORK_TEMPLATE));

            // If template selected, create a new board from this template
            if (canCreateFromPluggable && createBoardFromChannelPlugin) {
                try {
                    addBoardToChannel(newChannel.id);
                } catch (e: any) {
                    // eslint-disable-next-line no-console
                    console.log(e.message);
                }
            }
            dispatch(switchToChannel(newChannel));
        } catch (e) {
            onCreateChannelError({message: formatMessage({id: 'channel_modal.error.generic', defaultMessage: 'Something went wrong. Please try again.'})});
        }
    };

    const addBoardToChannel = async (channelId: string) => {
        if (!createBoardFromChannelPlugin) {
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
            dispatch(setNewChannelWithBoardPreference({[ReduxPreferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED]: false}));
        }
        return true;
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

    const handleOnDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        const {target: {value: displayName}} = e;

        const displayNameErrors = validateDisplayName(displayName);

        setDisplayNameError(displayNameErrors.length ? displayNameErrors[displayNameErrors.length - 1] : '');
        setDisplayName(displayName);
        setServerError('');

        if (!urlModified) {
            setURL(cleanUpUrlable(displayName));
            setURLError('');
        }
    };

    const handleNameBlur = (e: React.FocusEvent): boolean => {
        if (
            !displayNameModified &&
            !(
                (e.nativeEvent as any)?.rangeParent?.parentNode?.closest('#work-templates-try-templates-aside') ||
                (e.nativeEvent as any)?.rangeParent?.parentNode?.closest('#work-templates-template-mode-tab')
            )
        ) {
            setDisplayNameModified(true);
            return true;
        }
        return false;
    };

    const handleOnURLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        const {target: {value: url}} = e;

        const cleanURL = url.toLowerCase().replace(/\s/g, '-');
        const urlErrors = validateChannelUrl(cleanURL, intl) as string[];

        setURLError(urlErrors.length ? urlErrors[urlErrors.length - 1] : '');
        setURL(cleanURL);
        setURLModified(true);
        setServerError('');
    };

    const handleOnTypeChange = (channelType: ChannelType) => {
        setType(channelType);
        setServerError('');
    };

    const handleOnPurposeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const {target: {value: purpose}} = e;

        setPurpose(purpose);
        setPurposeError('');
        setServerError('');
    };

    const canCreate = displayName && !displayNameError && url && !urlError && type && !purposeError && !serverError && canCreateFromPluggable;

    return {
        state: {
            canCreate,
            displayName,
            url,
            purpose,
            displayNameModified,
            urlModified,
            displayNameError,
            urlError,
            purposeError,
            serverError,
            type,
            canCreatePublicChannel,
            canCreatePrivateChannel,
            createBoardFromChannelPlugin,
        },

        // for internal state
        set: {
            name: handleOnDisplayNameChange,
            type: handleOnTypeChange,
            purpose: handleOnPurposeChange,
            url: handleOnURLChange,
            handleNameBlur,
            canCreateFromPluggable: setCanCreateFromPluggable,
            actionFromPluggable: setActionFromPluggable,
        },

        // for external state
        actions: {
            handleOnModalConfirm,
        },
    };
}

const handleOnPurposeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Avoid firing the handleEnterKeyPress in GenericModal from purpose textarea
    e.stopPropagation();
};

const ChannelOnly = (props: Props) => {
    const intl = useIntl();
    const {formatMessage} = intl;
    const currentTeamName = useSelector(getCurrentTeam).name;
    const [knowsTemplatesExistString] = usePreference(Preferences.TOUCHED, Touched.KNOWS_TEMPLATES_EXIST);
    const knowsTemplatesExist = knowsTemplatesExistString === 'true';
    const {set, state, actions} = props.manager;

    const isConfirmDisabled = !state.canCreate;

    const newBoardInfoIcon = (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='right'
            overlay={(
                <Tooltip
                    id='new-channel-with-board-tooltip'
                >
                    <BoardTooltipTitle>
                        <FormattedMessage
                            id={'channel_modal.create_board.tooltip_title'}
                            defaultMessage={'Manage your task with a board'}
                        />
                    </BoardTooltipTitle>
                    <BoardTooltipDescription>
                        <FormattedMessage
                            id={'channel_modal.create_board.tooltip_description'}
                            defaultMessage={'Use any of our templates to manage your tasks or start from scratch with your own!'}
                        />
                    </BoardTooltipDescription>
                </Tooltip>
            )}
        >
            <i className='icon-information-outline'/>
        </OverlayTrigger>
    );

    const shouldValidateOnBlur = (e: React.FocusEvent): boolean => {
        return !(
            (e.nativeEvent as any)?.rangeParent?.parentNode?.closest('#work-templates-try-templates-aside') ||
            (e.nativeEvent as any)?.rangeParent?.parentNode?.closest('#work-templates-template-mode-tab')
        );
    };

    return (
        <ChannelOnlyBody className='channel-only-body'>
            <GlobalStyle/>
            {props.workTemplatesEnabled && (<Aside tryTemplates={props.tryTemplates}/>)}
            <Main>
                <ChannelOnlyMainBody>
                    <Input
                        type='text'
                        autoComplete='off'
                        autoFocus={Boolean(knowsTemplatesExist)}
                        required={true}
                        name='new-channel-modal-name'
                        inputClassName='channel-name'
                        label={formatMessage({id: 'channel_modal.name.label', defaultMessage: 'Channel name'})}
                        placeholder={formatMessage({id: 'channel_modal.name.placeholder', defaultMessage: 'Enter a name for your new channel'})}
                        limit={Constants.MAX_CHANNELNAME_LENGTH}
                        value={state.displayName}
                        customMessage={state.displayNameModified ? {type: ItemStatus.ERROR, value: state.displayNameError} : null}
                        onChange={set.name}
                        onBlur={set.handleNameBlur}
                        shouldValidateOnBlur={shouldValidateOnBlur}
                    />
                    <URLInput
                        className='channel-url'
                        base={getSiteURL()}
                        path={`${currentTeamName}/channels`}
                        pathInfo={state.url}
                        limit={Constants.MAX_CHANNELNAME_LENGTH}
                        shortenLength={Constants.DEFAULT_CHANNELURL_SHORTEN_LENGTH}
                        error={state.urlError}
                        onChange={set.url}
                    />
                    <PublicPrivateSelector
                        className='channel-type-selector'
                        selected={state.type}
                        publicButtonProps={{
                            title: formatMessage({id: 'channel_modal.type.public.title', defaultMessage: 'Public Channel'}),
                            description: formatMessage({id: 'channel_modal.type.public.description', defaultMessage: 'Anyone can join'}),
                            disabled: !state.canCreatePublicChannel,
                        }}
                        privateButtonProps={{
                            title: formatMessage({id: 'channel_modal.type.private.title', defaultMessage: 'Private Channel'}),
                            description: formatMessage({id: 'channel_modal.type.private.description', defaultMessage: 'Only invited members'}),
                            disabled: !state.canCreatePrivateChannel,
                        }}
                        onChange={set.type}
                    />
                    <PurposeContainer>
                        <Purpose
                            id='new-channel-modal-purpose'
                            error={state.purposeError !== ''}
                            placeholder={formatMessage({id: 'channel_modal.purpose.placeholder', defaultMessage: 'Enter a purpose for this channel (optional)'})}
                            rows={4}
                            maxLength={Constants.MAX_CHANNELPURPOSE_LENGTH}
                            autoComplete='off'
                            value={state.purpose}
                            onChange={set.purpose}
                            onKeyDown={handleOnPurposeKeyDown}
                        />
                        {state.purposeError ? (
                            <PurposeError>
                                <i className='icon icon-alert-outline'/>
                                <span>{state.purposeError}</span>
                            </PurposeError>
                        ) : (
                            <PurposeInfo>
                                <span>
                                    {formatMessage({id: 'channel_modal.purpose.info', defaultMessage: 'This will be displayed when browsing for channels.'})}
                                </span>
                            </PurposeInfo>
                        )}
                        {state.createBoardFromChannelPlugin &&
                            <Pluggable
                                pluggableName='CreateBoardFromTemplate'
                                setCanCreate={set.canCreateFromPluggable}
                                setAction={set.actionFromPluggable}
                                newBoardInfoIcon={newBoardInfoIcon}
                            />
                        }
                    </PurposeContainer>
                </ChannelOnlyMainBody>
                <ChannelOnlyFooter
                    isConfirmDisabled={isConfirmDisabled}
                    createChannel={actions.handleOnModalConfirm}
                />
            </Main>
        </ChannelOnlyBody>
    );
};

// sometimes, channel_only content overflows and a scrollbar must be shown.
// We adjust the padding from what it would otherwise be to make allowance
// for that to not show the footer over the top.
const genericModalSidePadding = '32px';

const PurposeContainer = styled.div`
    margin-top: 28px;
`;
const PurposeInfo = styled.div`
    margin-top: 5px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    line-height: 16px;
    text-align: left;
`;

interface PurposeProps{
    error: boolean;
}
const Purpose = styled.textarea<PurposeProps>`
    width: 100%;
    box-sizing: border-box;
    padding: 12px 16px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    ${(props) => (props.error ? 'border-color: var(--error-text);' : '')}    
    background: var(--center-channel-bg);
    border-radius: 4px;
    color: var(--center-channel-color);
    font-size: 14px;
    line-height: 20px;
    resize: none;

    &:hover {
        border-color: rgba(var(--center-channel-color-rgb), 0.48);
    }

    &:focus {
        border-color: var(--button-bg);
        box-shadow: inset 0 0 0 1px var(${(props) => (props.error ? '--error-text' : '--button-bg')});
    }
`;

const PurposeError = styled.div`
    display: flex;
    margin-top: 5px;
    color: var(--error-text);
    font-size: 12px;
    line-height: 16px;
    text-align: left;

    i {
        height: 14px;
        align-self: baseline;
        margin-right: 7px;
        font-size: 14px;

        &::before {
            margin: 0;
        }
    }
`;

const ChannelOnlyBody = styled.div`
  display: flex;
`;
const Main = styled.div`
    flex-grow: 1;
    flex-shrink 1;
    padding: calc(${genericModalSidePadding} - 10px) calc(${genericModalSidePadding} - ${overlayScrollbarAllowance}) 0  ${genericModalSidePadding};
`;

const GlobalStyle = createGlobalStyle`
.channel-only-body {
    .channel-name {
        height: 34px !important;
        border: 0 !important;
        border-radius: 0 !important;
    }
  
    .channel-type-selector {
        margin-top: 24px;
    }
    .channel-url {
        margin-top: 4px;
    }
}
`;

const boardTooltipTextStyle = `
    span {
        display: block;
        width: 100%;
        text-align: left !important;
    }
`;
const BoardTooltipTitle = styled.div`
    font-weight: 800;
    ${boardTooltipTextStyle}
`;
const BoardTooltipDescription = styled.div`
    font-weight: 500;
    ${boardTooltipTextStyle}
`;

// all work-templates screens should be 610px.
// But they use different layouts.
// So we need to set different values on different containers to get that effect.
const ENSURE_610_HEIGHT = '395px';
const ChannelOnlyMainBody = styled.div`
    height: ${ENSURE_610_HEIGHT};
    padding-top: 10px;
    padding-right: ${overlayScrollbarAllowance};
    overflow-y: auto;
`;
export default ChannelOnly;
