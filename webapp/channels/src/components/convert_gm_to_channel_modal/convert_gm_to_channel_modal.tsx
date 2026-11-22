// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ComponentProps} from 'react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import './convert_gm_to_channel_modal.scss';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {isPropertyFieldRequired, isPropertyFieldSourceManaged} from 'mattermost-redux/utils/property_utils';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {getGroupMessageMembersCommonTeams} from 'actions/team_actions';

import type {ChannelAttributeSelection} from 'components/channel_attributes/channel_attributes_form';
import ChannelAttributesForm from 'components/channel_attributes/channel_attributes_form';
import ChannelNameFormField from 'components/channel_name_form_field/channel_name_form_field';
import useRequiredChannelAttributesToAsk from 'components/common/hooks/useRequiredChannelAttributesToAsk';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import NoCommonTeamsError from './no_common_teams/no_common_teams';
import TeamSelector from './team_selector/team_selector';
import WarningTextSection from './warning_text_section/warning_text_section';

import type {Actions} from './index';

const enum ServerErrorId {
    CHANNEL_NAME_EXISTS = 'store.sql_channel.save_channel.exists.app_error',
}

export type Props = {
    onExited: () => void;
    channel: Channel;
    actions: Actions;
    profilesInChannel: UserProfile[];
    teammateNameDisplaySetting: string;
    currentUserId: string;
};

const ConvertGmToChannelModal = (props: Props) => {
    const intl = useIntl();
    const {formatMessage} = intl;

    const [channelName, setChannelName] = useState<string>('');
    const channelURL = useRef<string>('');

    const [urlError, setURLError] = useState('');
    const handleChannelURLChange = useCallback((newURL: string) => {
        channelURL.current = newURL;
        setURLError('');
    }, []);

    const [channelMemberNames, setChannelMemberNames] = useState<string[]>([]);

    useEffect(() => {
        const validProfilesInChannel = props.profilesInChannel.
            filter((user) => user.id !== props.currentUserId && user.delete_at === 0).
            map((user) => displayUsername(user, props.teammateNameDisplaySetting));

        setChannelMemberNames(validProfilesInChannel);
    }, [props.profilesInChannel, props.currentUserId, props.teammateNameDisplaySetting]);

    const [commonTeamsById, setCommonTeamsById] = useState<{[id: string]: Team}>({});
    const [commonTeamsFetched, setCommonTeamsFetched] = useState<boolean>(false);
    const [loadingAnimationTimeout, setLoadingAnimationTimeout] = useState<boolean>(false);
    const [selectedTeamId, setSelectedTeamId] = useState<string>();
    const [nameError, setNameError] = useState<boolean>(false);
    const [conversionError, setConversionError] = useState<string>();

    const attributesToAsk = useRequiredChannelAttributesToAsk({teamId: selectedTeamId ?? ''}, {requiredOnly: true});

    // Only required fields are asked here; the optional classification courtesy
    // the create dialog offers is not part of a conversion. Source-managed fields
    // are written by their owner only: the server refuses a value for them, and
    // doesn't wait for one.
    const requiredFields = useMemo(() => attributesToAsk.fields.filter((field) => isPropertyFieldRequired(field) && !isPropertyFieldSourceManaged(field)), [attributesToAsk.fields]);
    const [attributeValues, setAttributeValues] = useState<ChannelAttributeSelection>({});
    const [converting, setConverting] = useState(false);

    const handleAttributeChange = useCallback((fieldId: string, value: string | string[] | undefined) => {
        setAttributeValues((current) => {
            const next = {...current};
            if (value === undefined) {
                Reflect.deleteProperty(next, fieldId);
            } else {
                next[fieldId] = value;
            }
            return next;
        });
    }, []);

    const requiredAttributesFilled = useMemo(() => requiredFields.every((field) => {
        const value = attributeValues[field.id];
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }), [requiredFields, attributeValues]);

    const dispatch = useDispatch();

    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return (() => {
            mounted.current = false;
        });
    }, []);

    useEffect(() => {
        const work = async () => {
            const response = await dispatch(getGroupMessageMembersCommonTeams(props.channel.id));
            if (!mounted.current) {
                return;
            }

            if (response.error || !response.data) {
                return;
            }
            const teams = response.data;

            const teamsById: {[id: string]: Team} = {};
            teams.forEach((team) => {
                teamsById[team.id] = team;
            });

            setCommonTeamsById(teamsById);
            setCommonTeamsFetched(true);

            // if there is only common team, selected it.
            if (teams.length === 1) {
                setSelectedTeamId(teams[0].id);
            }
        };

        work();
        setTimeout(() => setLoadingAnimationTimeout(true), 1200);
    }, [dispatch, props.channel.id]);

    const handleConfirm = useCallback(async () => {
        if (!selectedTeamId) {
            return;
        }

        const propertyValues = requiredFields.map((field) => ({field_id: field.id, value: attributeValues[field.id]}));

        const name = channelName.trim();
        const url = channelURL.current.trim();

        setConverting(true);
        let result;
        if (propertyValues.length > 0) {
            result = await props.actions.convertGroupMessageToPrivateChannel(props.channel.id, selectedTeamId, name, url, propertyValues);
        } else {
            result = await props.actions.convertGroupMessageToPrivateChannel(props.channel.id, selectedTeamId, name, url);
        }
        const {error} = result;
        if (!mounted.current) {
            return;
        }
        setConverting(false);

        if (error) {
            if (error.server_error_id === ServerErrorId.CHANNEL_NAME_EXISTS) {
                setURLError(
                    formatMessage({
                        id: 'channel_modal.alreadyExist',
                        defaultMessage: 'A channel with that URL already exists',
                    }),
                );
            } else {
                setConversionError(error.message);
            }

            return;
        }

        setConversionError(undefined);
        props.onExited();
    }, [selectedTeamId, props, channelName, formatMessage, requiredFields, attributeValues]);

    const showLoader = !commonTeamsFetched || !loadingAnimationTimeout;
    const canCreate = selectedTeamId !== undefined && channelName !== '' && !nameError && !urlError && requiredAttributesFilled && !(attributesToAsk.enabled && (attributesToAsk.loading || converting));
    const modalProps: Partial<ComponentProps<typeof GenericModal>> = {};
    let modalBody;

    if (!showLoader && Object.keys(commonTeamsById).length === 0) {
        modalProps.confirmButtonText = formatMessage({id: 'generic.okay', defaultMessage: 'Okay'});
        modalProps.handleConfirm = props.onExited;

        modalBody = (
            <div className='convert-gm-to-channel-modal-body error'>
                <NoCommonTeamsError/>
            </div>
        );
    } else {
        modalProps.handleCancel = showLoader ? undefined : props.onExited;
        modalProps.destructive = true;
        modalProps.cancelButtonText = formatMessage({id: 'channel_modal.cancel', defaultMessage: 'Cancel'});
        modalProps.confirmButtonText = formatMessage({id: 'sidebar_left.sidebar_channel_modal.confirmation_text', defaultMessage: 'Convert to private channel'});
        modalProps.isConfirmDisabled = !canCreate;

        let subBody;
        if (showLoader) {
            subBody = (
                <div className='loadingIndicator'>
                    <LoadingSpinner size='32'/>
                </div>
            );
        } else {
            subBody = (
                <>
                    <WarningTextSection channelMemberNames={channelMemberNames}/>

                    {
                        Object.keys(commonTeamsById).length > 1 &&
                        <TeamSelector
                            teamsById={commonTeamsById}
                            onChange={setSelectedTeamId}
                        />
                    }

                    <ChannelNameFormField
                        value={channelName}
                        name='convert-gm-to-channel-modal-channel-name'
                        placeholder={formatMessage({id: 'sidebar_left.sidebar_channel_modal.channel_name_placeholder', defaultMessage: 'Enter a name for the channel'})}
                        autoFocus={false}
                        onDisplayNameChange={setChannelName}
                        onURLChange={handleChannelURLChange}
                        onErrorStateChange={setNameError}
                        team={selectedTeamId ? commonTeamsById[selectedTeamId] : undefined}
                        urlError={urlError}
                    />

                    <ChannelAttributesForm
                        fields={requiredFields}
                        values={attributeValues}
                        onChange={handleAttributeChange}
                        disabled={converting}
                    />

                    {
                        conversionError &&
                        <div className='conversion-error'>
                            <i className='icon icon-alert-outline'/>
                            <span>{conversionError}</span>
                        </div>
                    }

                </>
            );
        }

        modalBody = (
            <div
                className={classNames({
                    'convert-gm-to-channel-modal-body': true,
                    loading: showLoader,
                    'single-team': Object.keys(commonTeamsById).length === 1,
                    'multi-team': Object.keys(commonTeamsById).length > 1,
                    'with-attributes': requiredFields.length > 0,
                })}
            >
                {subBody}
            </div>
        );
    }

    return (
        <GenericModal
            id='convert-gm-to-channel-modal'
            className='convert-gm-to-channel-modal'
            modalHeaderText={formatMessage({id: 'sidebar_left.sidebar_channel_modal.header', defaultMessage: 'Convert to Private Channel'})}
            compassDesign={true}
            handleConfirm={showLoader ? undefined : handleConfirm}
            onExited={props.onExited}
            autoCloseOnConfirmButton={false}
            {...modalProps}
        >
            {modalBody}
        </GenericModal>
    );
};

export default ConvertGmToChannelModal;
