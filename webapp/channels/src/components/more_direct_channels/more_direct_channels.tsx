// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import type MultiSelect from 'components/multiselect/multiselect';

import {focusElement} from 'utils/a11y_utils';
import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';

import List from './list';
import {USERS_PER_PAGE} from './list/list';
import {isGroupChannel, optionValue} from './types';
import type {OptionValue} from './types';

export type Props = {
    currentUserId: string;
    currentTeamId?: string;
    currentTeamName?: string;
    searchTerm: string;
    users: UserProfile[];
    totalCount: number;

    /*
    * List of current channel members of existing channel
    */
    currentChannelMembers?: UserProfile[];

    /*
    * Whether the modal is for existing channel or not
    */
    isExistingChannel: boolean;

    /*
    * The mode by which direct messages are restricted, if at all.
    */
    restrictDirectMessage?: string;
    onModalDismissed?: () => void;
    onExited?: () => void;
    actions: {
        getProfiles: (page?: number, perPage?: number, options?: any) => Promise<ActionResult>;
        getProfilesInTeam: (teamId: string, page: number, perPage?: number, sort?: string, options?: any) => Promise<ActionResult>;
        loadProfilesMissingStatus: (users: UserProfile[]) => void;
        getTotalUsersStats: () => void;
        loadStatusesForProfilesList: (users: UserProfile[]) => void;
        loadProfilesForGroupChannels: (groupChannels: Channel[]) => void;
        openDirectChannelToUserId: (userId: string) => Promise<ActionResult>;
        openGroupChannelToUserIds: (userIds: string[]) => Promise<ActionResult>;
        searchProfiles: (term: string, options: any) => Promise<ActionResult<UserProfile[]>>;
        searchGroupChannels: (term: string) => Promise<ActionResult<Channel[]>>;
        setModalSearchTerm: (term: string) => void;
        canUserDirectMessage: (userId: string, otherUserId: string) => Promise<ActionResult<{can_dm: boolean}>>;
    };
    focusOriginElement: string;
}

type State = {
    values: OptionValue[];
    show: boolean;
    search: boolean;
    saving: boolean;
    loadingUsers: boolean;
    directMessageCapabilityCache: Record<string, boolean>;
}

export default class MoreDirectChannels extends React.PureComponent<Props, State> {
    searchTimeoutId: any;
    exitToChannel?: string;
    multiselect: React.RefObject<MultiSelect<OptionValue>>;
    selectedItemRef: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.searchTimeoutId = 0;
        this.multiselect = React.createRef();
        this.selectedItemRef = React.createRef();

        const values: OptionValue[] = [];
        if (props.currentChannelMembers) {
            for (let i = 0; i < props.currentChannelMembers.length; i++) {
                const user = Object.assign({}, props.currentChannelMembers[i]);
                if (user.id === props.currentUserId) {
                    continue;
                }
                values.push(optionValue(user));
            }
        }

        this.state = {
            values,
            show: true,
            search: false,
            saving: false,
            loadingUsers: true,
            directMessageCapabilityCache: {},
        };
    }

    loadModalData = () => {
        this.getUserProfiles();
        this.props.actions.getTotalUsersStats();
        this.props.actions.loadProfilesMissingStatus(this.props.users);
        this.checkDMCapabilities(this.props.users);
    };

    checkDMCapabilities = async (users: UserProfile[]) => {
        const {currentUserId} = this.props;
        const {directMessageCapabilityCache} = this.state;
        const usersToCheck = users.filter((user) =>
            user.id !== currentUserId &&
            user.remote_id &&
            !(user.id in directMessageCapabilityCache),
        );

        if (usersToCheck.length === 0) {
            return;
        }

        const promises = usersToCheck.map(async (user) => {
            try {
                const result = await this.props.actions.canUserDirectMessage(currentUserId, user.id);
                return {userId: user.id, canDM: result.data?.can_dm ?? false};
            } catch {
                return {userId: user.id, canDM: false};
            }
        });

        const results = await Promise.all(promises);
        const newCache = {...directMessageCapabilityCache};
        results.forEach(({userId, canDM}) => {
            newCache[userId] = canDM;
        });

        this.setState({directMessageCapabilityCache: newCache});
    };

    updateFromProps(prevProps: Props) {
        if (prevProps.searchTerm !== this.props.searchTerm) {
            clearTimeout(this.searchTimeoutId);

            const searchTerm = this.props.searchTerm;
            if (searchTerm === '') {
                this.resetPaging();
            } else {
                const teamId = this.props.restrictDirectMessage === 'any' ? '' : this.props.currentTeamId;

                this.searchTimeoutId = setTimeout(
                    async () => {
                        this.setUsersLoadingState(true);
                        const [{data: profilesData}, {data: groupChannelsData}] = await Promise.all([
                            this.props.actions.searchProfiles(searchTerm, {team_id: teamId}),
                            this.props.actions.searchGroupChannels(searchTerm),
                        ]);
                        if (profilesData) {
                            this.props.actions.loadStatusesForProfilesList(profilesData);
                        }
                        if (groupChannelsData) {
                            this.props.actions.loadProfilesForGroupChannels(groupChannelsData);
                        }
                        this.resetPaging();
                        this.setUsersLoadingState(false);
                    },
                    Constants.SEARCH_TIMEOUT_MILLISECONDS,
                );
            }
        }

        if (prevProps.users.length !== this.props.users.length) {
            this.props.actions.loadProfilesMissingStatus(this.props.users);
            this.checkDMCapabilities(this.props.users);
        }
    }

    componentDidUpdate(prevProps: Props) {
        this.updateFromProps(prevProps);
    }

    setUsersLoadingState = (loadingState: boolean) => {
        this.setState({loadingUsers: loadingState});
    };

    handleHide = () => {
        this.props.actions.setModalSearchTerm('');
        this.setState({show: false});
    };

    handleExit = () => {
        this.props.onExited?.();
        this.props.onModalDismissed?.();

        if (this.exitToChannel) {
            getHistory().push(this.exitToChannel);
        } else if (this.props.focusOriginElement) {
            setTimeout(() => {
                focusElement(this.props.focusOriginElement, true);
            }, 0);
        }
    };

    handleSubmit = (values = this.state.values) => {
        const {actions} = this.props;

        if (this.state.saving) {
            return;
        }

        const userIds = values.map((v) => v.id);
        if (userIds.length === 0) {
            return;
        }

        this.setState({saving: true});

        const done = (result: any) => {
            const {data, error} = result;
            this.setState({saving: false});

            if (!error) {
                this.exitToChannel = '/' + this.props.currentTeamName + '/channels/' + data.name;
                this.handleHide();
            }
        };

        if (userIds.length === 1) {
            actions.openDirectChannelToUserId(userIds[0]).then(done);
        } else {
            actions.openGroupChannelToUserIds(userIds).then(done);
        }
    };

    addValue = (value: OptionValue) => {
        if (isGroupChannel(value)) {
            this.addUsers(value.profiles);
        } else {
            const values = [...this.state.values];
            if (!values.includes(value)) {
                values.push(value);
            }
            this.setState({values});
        }
    };

    addUsers = (users: UserProfile[]) => {
        const values = [...this.state.values];
        const existingUserIds = values.map((user) => user.id);
        for (const user of users) {
            if (!existingUserIds.includes(user.id)) {
                values.push(optionValue(user));
            }
        }
        this.setState({values});
    };

    getUserProfiles = (page?: number) => {
        const pageNum = page ? page + 1 : 0;
        if (this.props.restrictDirectMessage === 'any') {
            this.props.actions.getProfiles(pageNum, USERS_PER_PAGE * 2).then(() => {
                this.setUsersLoadingState(false);
            });
        } else {
            this.props.actions.getProfilesInTeam(this.props.currentTeamId || '', pageNum, USERS_PER_PAGE * 2).then(() => {
                this.setUsersLoadingState(false);
            });
        }
    };

    handlePageChange = (page: number, prevPage: number) => {
        if (page > prevPage) {
            this.setUsersLoadingState(true);
            this.getUserProfiles(page);
        }
    };

    resetPaging = () => {
        this.multiselect.current?.resetPaging();
    };

    search = debounce((term: string) => {
        this.props.actions.setModalSearchTerm(term);
    }, 250);

    handleDelete = (values: OptionValue[]) => {
        this.setState({values});
    };

    getDirectMessageableUsers = (): UserProfile[] => {
        const {users} = this.props;
        const {directMessageCapabilityCache} = this.state;

        return users.filter((user) => {
            // For remote users, check if they can be DMed
            if (user.remote_id) {
                // If we haven't checked this user yet, hide them until we have the result
                if (!(user.id in directMessageCapabilityCache)) {
                    return false;
                }

                // Only show if they can be DMed
                return directMessageCapabilityCache[user.id];
            }

            // Show local users (including self)
            return true;
        });
    };

    render() {
        const filteredUsers = this.getDirectMessageableUsers();
        const body = (
            <List
                addValue={this.addValue}
                currentUserId={this.props.currentUserId}
                handleDelete={this.handleDelete}
                handlePageChange={this.handlePageChange}
                handleSubmit={this.handleSubmit}
                handleHide={this.handleHide}
                isExistingChannel={this.props.isExistingChannel}
                loading={this.state.loadingUsers}
                saving={this.state.saving}
                search={this.search}
                selectedItemRef={this.selectedItemRef}
                totalCount={this.props.totalCount}
                users={filteredUsers}
                values={this.state.values}
            />
        );

        const modalHeaderText = (
            <FormattedMessage
                id='more_direct_channels.title'
                defaultMessage='Direct Messages'
            />
        );

        return (
            <GenericModal
                id='moreDmModal'
                className='a11y__modal more-modal more-direct-channels more-direct-channels-generic-modal'
                show={this.state.show}
                modalHeaderText={modalHeaderText}
                onExited={this.handleExit}
                onHide={this.handleExit}
                compassDesign={true}
                bodyPadding={false}
                onEntered={this.loadModalData}
                modalLocation={'top'}
                delayFocusTrap={true}
            >
                <div role='application'>
                    {body}
                </div>
            </GenericModal>
        );
    }
}
