// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';
import {useHistory, useParams, useLocation} from 'react-router-dom';
import styled from 'styled-components';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {isRemoteClusterPatch, type RemoteCluster} from '@mattermost/types/remote_clusters';

import {setNavigationBlocked} from 'actions/admin_actions';

import BlockableLink from 'components/admin_console/blockable_link';
import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import ChatSvg from './chat.svg';
import {
    AdminSection,
    SectionHeader,
    SectionHeading,
    SectionContent,
    PlaceholderContainer,
    PlaceholderHeading,
    AdminWrapper,
    PlaceholderParagraph,
    Input,
    FormField,
} from './controls';
import {getEditLocation, isErrorState, isPendingState, useRemoteClusterCreate, useRemoteClusterEdit} from './utils';

import SaveChangesPanel from '../team_channel_settings/save_changes_panel';

type Params = {
    connection_id: 'create' | RemoteCluster['remote_id'];
};

type Props = Params & {
    disabled: boolean;
}

export default function SecureConnectionDetail(props: Props) {
    const {formatMessage} = useIntl();
    const {connection_id: remoteId} = useParams<Params>();
    const isCreating = remoteId === 'create';
    const {state: initRemoteCluster, ...location} = useLocation<RemoteCluster | undefined>();
    const history = useHistory();
    const dispatch = useDispatch();

    const sharedChannelsRows = placeholder;

    const [remoteCluster, {applyPatch, save, currentRemoteCluster, hasChanges, loading, saving, patch}] = useRemoteClusterEdit(remoteId, initRemoteCluster);

    const {promptCreate, saving: creating} = useRemoteClusterCreate();

    const isFormValid = isRemoteClusterPatch(patch);

    useEffect(() => {
        // keep history cache up to date
        history.replace({...location, state: currentRemoteCluster});
    }, [currentRemoteCluster]);

    useEffect(() => {
        // block nav when change s are pending
        dispatch(setNavigationBlocked(hasChanges));
    }, [hasChanges]);

    const handleChange = ({currentTarget: {value}}: React.FormEvent<HTMLInputElement>) => {
        applyPatch({display_name: value});
    };

    const handleCreate = async () => {
        if (!isFormValid) {
            return;
        }
        try {
            const rc = await promptCreate(patch);
            if (rc) {
                history.replace(getEditLocation(rc));
            }
        } catch (err) {
            // handle err
        }
    };

    return (
        <div
            className='wrapper--fixed'
            data-testid='connectedOrganizationDetailsSection'
        >
            <AdminHeader withBackButton={true}>
                <div>
                    <BlockableLink
                        to='/admin_console/environment/secure_connections'
                        className='fa fa-angle-left back'
                    />
                    <FormattedMessage
                        id='admin.secure_connection_detail.page_title'
                        defaultMessage='Connection Configuration'
                    />
                </div>
            </AdminHeader>

            <AdminWrapper>
                <AdminSection data-testid='connection_detail_section'>
                    <SectionHeader>
                        <hgroup>
                            <FormattedMessage
                                tagName={SectionHeading}
                                id='admin.secure_connections.details.title'
                                defaultMessage='Connection Details'
                            />
                            <FormattedMessage
                                id='admin.secure_connections.details.subtitle'
                                defaultMessage='Connection name and other permissions'
                            />
                        </hgroup>
                    </SectionHeader>
                    <SectionContent $compact={true}>
                        {isPendingState(loading) ? (
                            <LoadingScreen/>
                        ) : (
                            <>
                                <FormField
                                    label={formatMessage({
                                        id: 'admin.secure_connections.details.org_name.label',
                                        defaultMessage: 'Organization Name',
                                    })}
                                    helpText={formatMessage({
                                        id: 'admin.secure_connections.details.org_name.help',
                                        defaultMessage: 'Giving the connection a recognizable name will help you remember its purpose.',
                                    })}
                                >
                                    <Input
                                        type='text'
                                        value={remoteCluster?.display_name ?? ''}
                                        onChange={handleChange}
                                        autoFocus={isCreating}
                                    />
                                </FormField>
                            </>
                        )}
                    </SectionContent>
                </AdminSection>
                <AdminSection data-testid='shared_channels_section'>
                    <SectionHeader>
                        <hgroup>
                            <FormattedMessage
                                tagName={SectionHeading}
                                id='admin.secure_connections.details.shared_channels.title'
                                defaultMessage='Shared Channels'
                            />
                            <FormattedMessage
                                id='admin.secure_connections.details.shared_channels.subtitle'
                                defaultMessage="A list of all the channels shared with your organization and channels you're sharing externally."
                            />
                        </hgroup>
                        <AddChannelsButton>
                            <PlusIcon size={18}/>
                            <FormattedMessage
                                id='admin.secure_connections.details.shared_channels.add_channels.button'
                                defaultMessage='Add Channels'
                            />
                        </AddChannelsButton>
                    </SectionHeader>
                    <SectionContent>{sharedChannelsRows}</SectionContent>
                </AdminSection>
            </AdminWrapper>

            <SaveChangesPanel
                saving={isCreating ? isPendingState(creating) : isPendingState(saving)}
                cancelLink='/admin_console/environment/secure_connections'
                saveNeeded={hasChanges && isFormValid}
                onClick={isCreating ? handleCreate : save}
                serverError={(isErrorState(saving) || isErrorState(creating)) ? (
                    <FormattedMessage
                        id='admin.secure_connections.saving_changes_error'
                        defaultMessage='There was an error while saving secure connection'
                    />
                ) : undefined}
                savingMessage={formatMessage({id: 'admin.secure_connections.saving_changes', defaultMessage: 'Saving secure connection…'})}
                isDisabled={props.disabled}
            />
        </div>
    );
}

const placeholder = (
    <PlaceholderContainer>
        <ChatSvg/>
        <hgroup>
            <FormattedMessage
                tagName={PlaceholderHeading}
                id='admin.secure_connection_detail.shared_channels.placeholder.title'
                defaultMessage="You haven't shared any channels"
            />
            <FormattedMessage
                tagName={PlaceholderParagraph}
                id='admin.secure_connection_detail.shared_channels.placeholder.subtitle'
                defaultMessage='Please add channels to start sharing'
            />
        </hgroup>
    </PlaceholderContainer>
);

const AddChannelsButton = styled.button.attrs({className: 'btn btn-primary'})`
    padding-left: 15px;
`;
