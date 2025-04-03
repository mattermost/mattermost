// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import type {SelectCallback} from 'react-bootstrap';
import {Tabs, Tab} from 'react-bootstrap';
import {useIntl, FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory, useParams, useLocation} from 'react-router-dom';
import styled from 'styled-components';

import {GlobeIcon, LockIcon, PlusIcon, ArchiveOutlineIcon} from '@mattermost/compass-icons/components';
import {isRemoteClusterPatch, type RemoteCluster} from '@mattermost/types/remote_clusters';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {setNavigationBlocked} from 'actions/admin_actions';

import BlockableLink from 'components/admin_console/blockable_link';
import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {isArchivedChannel} from 'utils/channel_utils';
import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

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
    ConnectionStatusLabel,
    LinkButton,
} from './controls';
import {useRemoteClusterCreate, useSharedChannelsAdd, useSharedChannelsRemove} from './modals/modal_utils';
import TeamSelector from './team_selector';
import type {SharedChannelRemoteRow} from './utils';
import {getEditLocation, isConfirmed, isErrorState, isPendingState, useRemoteClusterEdit, useSharedChannelRemoteRows, useTeamOptions} from './utils';

import {AdminConsoleListTable} from '../list_table';
import SaveChangesPanel from '../save_changes_panel';

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

    const [remoteCluster, {applyPatch, save, currentRemoteCluster, hasChanges, loading, saving, patch}] = useRemoteClusterEdit(remoteId, initRemoteCluster);
    const isFormValid = isRemoteClusterPatch(patch) && (!isCreating || Boolean(patch.display_name && patch.default_team_id));

    const {promptCreate, saving: creating} = useRemoteClusterCreate();

    const teamsById = useTeamOptions();

    useEffect(() => {
        // keep history cache up to date
        history.replace({...location, state: currentRemoteCluster});
    }, [currentRemoteCluster]);

    useEffect(() => {
        // block nav when changes are pending
        dispatch(setNavigationBlocked(hasChanges));
    }, [hasChanges]);

    const handleNameChange = ({currentTarget: {value}}: React.FormEvent<HTMLInputElement>) => {
        applyPatch({display_name: value});
    };

    const handleTeamChange = (teamId: string) => {
        applyPatch({default_team_id: teamId});
    };

    const handleCreate = async () => {
        if (!isFormValid) {
            return;
        }
        const rc = await promptCreate(patch);
        if (rc) {
            history.replace(getEditLocation(rc));
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
                        to='/admin_console/site_config/secure_connections'
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
                        {currentRemoteCluster && <ConnectionStatusLabel rc={currentRemoteCluster}/>}
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
                                        data-testid='organization-name-input'
                                        value={remoteCluster?.display_name ?? ''}
                                        onChange={handleNameChange}
                                        autoFocus={isCreating}
                                    />
                                </FormField>
                                <FormField
                                    label={formatMessage({
                                        id: 'admin.secure_connections.details.team.label',
                                        defaultMessage: 'Destination Team',
                                    })}
                                    helpText={formatMessage({
                                        id: 'admin.secure_connections.details.team.help',
                                        defaultMessage: 'Select the default team in which any shared channels will be placed. This can be updated later for specific shared channels.',
                                    })}
                                >
                                    <TeamSelector
                                        testId='destination-team-input'
                                        value={remoteCluster.default_team_id ?? ''}
                                        teamsById={teamsById}
                                        onChange={handleTeamChange}
                                    />
                                </FormField>
                            </>
                        )}
                    </SectionContent>
                </AdminSection>
                {!isCreating && (
                    <AdminSection data-testid='shared_channels_section'>
                        <SharedChannelRemotes
                            remoteId={remoteId}
                            rc={currentRemoteCluster}
                        />
                    </AdminSection>
                )}
            </AdminWrapper>

            <SaveChangesPanel
                saving={isCreating ? isPendingState(creating) : isPendingState(saving)}
                cancelLink='/admin_console/site_config/secure_connections'
                saveNeeded={hasChanges && isFormValid}
                onClick={isCreating ? handleCreate : save}
                serverError={(isErrorState(saving) || isErrorState(creating)) ? (
                    <FormattedMessage
                        id='admin.secure_connections.details.saving_changes_error'
                        defaultMessage='There was an error while saving secure connection'
                    />
                ) : undefined}
                savingMessage={formatMessage({id: 'admin.secure_connections.details.saving_changes', defaultMessage: 'Saving secure connection…'})}
                isDisabled={props.disabled}
            />
        </div>
    );
}

function SharedChannelRemotes(props: {remoteId: string; rc: RemoteCluster | undefined}) {
    const [filter, setFilter] = useState<'home' | 'remote'>();
    const [data, {loading, fetch}] = useSharedChannelRemoteRows(props.remoteId, {filter});
    const {promptAdd} = useSharedChannelsAdd(props.remoteId);
    const confirmed = props.rc ? isConfirmed(props.rc) : undefined;
    const showTabs = confirmed ? true : !(confirmed === false && filter === 'home' && !data);

    useEffect(() => {
        //once we know confirmation status, set default filter/tab
        if (confirmed) {
            setFilter('remote');
        } else if (confirmed === false) {
            setFilter('home');
        }
    }, [confirmed]);

    const handleChangeTab = useCallback<SelectCallback>((tabKey) => {
        setFilter(tabKey);
    }, []);

    const handleAdd = async () => {
        await promptAdd();

        // TODO server side async
        setTimeout(() => {
            if (filter === 'remote') {
                setFilter('home');
            } else {
                fetch();
            }
        }, 500);
    };

    let content;

    if (loading || !props.rc) {
        content = <LoadingScreen/>;
    } else if (data) {
        content = (
            <SharedChannelRemotesTable
                data={data}
                filter={filter ?? 'home'}
                fetch={fetch}
            />
        );
    } else {
        content = (
            <Placeholder
                filter={filter ?? 'home'}
                rc={props.rc}
            />
        );
    }

    return (
        <>
            <SectionHeader $borderless={true}>
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
                <AddChannelsButton onClick={handleAdd}>
                    <PlusIcon size={18}/>
                    <FormattedMessage
                        id='admin.secure_connections.details.shared_channels.add_channels.button'
                        defaultMessage='Add channels'
                    />
                </AddChannelsButton>
            </SectionHeader>
            <TabsWrapper>
                {showTabs && (
                    <Tabs
                        id='shared-channels'
                        className='tabs'
                        defaultActiveKey={'remote'}
                        activeKey={filter}
                        onSelect={handleChangeTab}
                        unmountOnExit={true}
                    >
                        <Tab
                            eventKey={'remote'}
                            title={props.rc?.display_name}
                        />
                        <Tab
                            eventKey={'home'}
                            title={(
                                <FormattedMessage
                                    id='admin.secure_connections.details.shared_channels.tabs.home'
                                    defaultMessage='Your channels'
                                />
                            )}
                        />
                    </Tabs>
                )}
                <SectionContent $compact={Boolean(data)}>
                    {content}
                </SectionContent>
            </TabsWrapper>
        </>
    );
}

const Placeholder = (props: {filter: 'home' | 'remote'; rc: RemoteCluster}) => {
    return (
        <PlaceholderContainer>
            <ChatSvg/>
            <hgroup>
                {props.filter === 'home' ? (
                    <>
                        <FormattedMessage
                            tagName={PlaceholderHeading}
                            id='admin.secure_connection_detail.shared_channels.placeholder.title_home'
                            defaultMessage="You haven't shared any channels"
                        />
                        <FormattedMessage
                            tagName={PlaceholderParagraph}
                            id='admin.secure_connection_detail.shared_channels.placeholder.subtitle'
                            defaultMessage='Please add channels to start sharing'
                        />
                    </>
                ) : (
                    <FormattedMessage
                        tagName={PlaceholderHeading}
                        id='admin.secure_connection_detail.shared_channels.placeholder.title_remote'
                        defaultMessage="{remote} hasn't shared any channels"
                        values={{
                            remote: props.rc.display_name,
                        }}
                    />
                )}

            </hgroup>
        </PlaceholderContainer>
    );
};

const AddChannelsButton = styled.button.attrs({className: 'btn btn-primary'})`
    padding-left: 15px;
`;

const TabsWrapper = styled.div`
    .tabs {
        display: flex;
        width: 100%;
        flex-direction: column;

        .nav-tabs {
            border-bottom: 1px solid var(--center-channel-color-12, rgba(63, 67, 80, 0.12));
        }
    }

    .nav-tabs {
        padding: 0 32px;
        margin: 0 0 8px;

        li {
            margin-right: 0;

            a {
                padding: 13px 12px;
                border: none;
                background: transparent;
                color: rgba(var(--center-channel-color-rgb), 0.75);
                font-size: 14px;
                font-weight: 600;
                line-height: 20px;
                transition: all 0.15s ease;

                &:hover,
                &:active,
                &:focus,
                &:focus-within {
                    border: none;
                    border-radius: none;
                    background: transparent;
                    color: var(--center-channel-color);
                }
            }

            &.active {
                border-bottom: 2px solid var(--denim-button-bg);

                a {
                    color: var(--denim-button-bg);
                }
            }

            &:not(:first-child) {
                margin-left: 8px;
            }
        }
    }
`;

const ChannelIcon = ({channelId}: {channelId: string}) => {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    let icon = <GlobeIcon size={16}/>;

    if (channel?.type === Constants.PRIVATE_CHANNEL) {
        icon = <LockIcon size={16}/>;
    }

    if (isArchivedChannel(channel)) {
        icon = <ArchiveOutlineIcon size={16}/>;
    }

    return (
        <ChannelIconWrapper>
            {icon}
        </ChannelIconWrapper>
    );
};

const ChannelIconWrapper = styled.span`
    vertical-align: middle;
    margin-right: 5px;
`;

const ChannelName = styled.span`
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
`;

const TeamName = styled.span`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

function SharedChannelRemotesTable(props: {data: SharedChannelRemoteRow[]; filter: 'home' | 'remote'; fetch: () => void}) {
    const col = createColumnHelper<SharedChannelRemoteRow>();

    const columns = useMemo<Array<ColumnDef<SharedChannelRemoteRow, any>>>(() => {
        return [
            col.accessor('display_name', {
                header: () => (
                    <FormattedMessage
                        id='admin.secure_connection_detail.shared_channels.table.name'
                        defaultMessage='Name'
                    />
                ),
                cell: ({row, getValue}) => (
                    <>
                        <ChannelIcon channelId={row.original.channel_id}/>
                        <ChannelName>{getValue()}</ChannelName>
                    </>
                ),
                enableHiding: false,
                enableSorting: true,
            }),
            col.accessor('team_display_name', {
                header: () => {
                    if (props.filter === 'home') {
                        return (
                            <FormattedMessage
                                id='admin.secure_connection_detail.shared_channels.table.team_home'
                                defaultMessage='Current Team'
                            />
                        );
                    }

                    return (
                        <FormattedMessage
                            id='admin.secure_connection_detail.shared_channels.table.team_remote'
                            defaultMessage='Destination Team'
                        />
                    );
                },
                cell: ({getValue}) => (
                    <TeamName>
                        {getValue()}
                    </TeamName>
                ),
                enableHiding: false,
                enableSorting: true,
            }),
            col.display({
                id: 'actions',
                cell: ({row}) => (
                    <RemoteActions
                        remote={row.original}
                        fetch={props.fetch}
                    />
                ),
                enableHiding: false,
                enableSorting: false,
            }),
        ];
    }, [props.data, props.filter, props.fetch]);

    const table = useReactTable({
        data: props.data,
        columns,
        initialState: {
            sorting: [
                {
                    id: 'display_name',
                    desc: false,
                },
            ],
        },
        getCoreRowModel: getCoreRowModel<SharedChannelRemoteRow>(),
        getSortedRowModel: getSortedRowModel<SharedChannelRemoteRow>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {
            tableId: 'sharedChannelRemotes',
            disablePaginationControls: true,
        },
        manualPagination: true,
    });

    // TODO consider refactoring ChannelList to support shared channel actions and reuse here
    return (
        <TableWrapper>
            <AdminConsoleListTable<SharedChannelRemoteRow> table={table}/>
        </TableWrapper>
    );
}

const TableWrapper = styled.div`
    table.adminConsoleListTable.sharedChannelRemotes {

        td, th {
            &:after, &:before {
                display: none;
            }
        }

        thead {
            border-top: none;
            border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
        }

        tbody {
            tr {
                border-top: none;
                td {
                    padding-block-end: 8px;
                    padding-block-start: 8px;

                }
            }
        }

        tfoot {
            border-top: none;
        }
    }
    .adminConsoleListTableContainer {
        padding: 2px 0px;
    }
`;

const RemoteActions = ({remote, fetch}: {remote: SharedChannelRemoteRow; fetch: () => void}) => {
    const {promptRemove} = useSharedChannelsRemove(remote.remote_id);

    const handleRemove = () => {
        promptRemove(remote.channel_id).then(fetch);
    };

    return (
        <RemoteActionsRoot>
            <LinkButton
                onClick={handleRemove}
                $destructive={true}
            >
                <FormattedMessage
                    id='admin.secure_connection_detail.shared_channels.table.remote_actions.remove'
                    defaultMessage='Remove'
                />
            </LinkButton>
        </RemoteActionsRoot>
    );
};

const RemoteActionsRoot = styled.div`
    text-align: right;
`;
