// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {debounce} from 'lodash';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {GenericAction} from 'mattermost-redux/types/actions';

import MultiSelect from 'components/multiselect/multiselect';

import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';

import List from './list';
import {USERS_PER_PAGE} from './list/list';
import {
    isGroupChannel,
    optionValue,
    OptionValue,
} from './types';

export type Props = {
    currentUserId: string;
    currentTeamId: string;
    currentTeamName: string;
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
        getProfiles: (page?: number | undefined, perPage?: number | undefined, options?: any) => Promise<any>;
        getProfilesInTeam: (teamId: string, page: number, perPage?: number | undefined, sort?: string | undefined, options?: any) => Promise<any>;
        loadProfilesMissingStatus: (users: UserProfile[]) => void;
        getTotalUsersStats: () => void;
        loadStatusesForProfilesList: (users: any) => {
            data: boolean;
        };
        loadProfilesForGroupChannels: (groupChannels: any) => void;
        openDirectChannelToUserId: (userId: any) => Promise<any>;
        openGroupChannelToUserIds: (userIds: any) => Promise<any>;
        searchProfiles: (term: string, options?: any) => Promise<any>;
        searchGroupChannels: (term: string) => Promise<any>;
        setModalSearchTerm: (term: any) => GenericAction;
    };
}

type State = {
    values: OptionValue[];
    show: boolean;
    search: boolean;
    saving: boolean;
    loadingUsers: boolean;
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
        };
    }

    loadModalData = () => {
        this.getUserProfiles();
        this.props.actions.getTotalUsersStats();
        this.props.actions.loadProfilesMissingStatus(this.props.users);
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

        if (
            prevProps.users.length !== this.props.users.length
        ) {
            this.props.actions.loadProfilesMissingStatus(this.props.users);
        }
    }

    componentDidUpdate(prevProps: Props) {
        this.updateFromProps(prevProps);
    }

    handleHide = () => {
        this.props.actions.setModalSearchTerm('');
        this.setState({show: false});
    };

    setUsersLoadingState = (loadingState: boolean) => {
        this.setState({
            loadingUsers: loadingState,
        });
    };

    handleExit = () => {
        if (this.exitToChannel) {
            getHistory().push(this.exitToChannel);
        }

        this.props.onModalDismissed?.();
        this.props.onExited?.();
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
            const values = Object.assign([], this.state.values);

            if (values.indexOf(value) === -1) {
                values.push(value);
            }

            this.setState({values});
        }
    };

    addUsers = (users: UserProfile[]) => {
        const values: OptionValue[] = Object.assign([], this.state.values);
        const existingUserIds = values.map((user) => user.id);
        for (const user of users) {
            if (existingUserIds.indexOf(user.id) !== -1) {
                continue;
            }
            values.push(optionValue(user));
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
            this.props.actions.getProfilesInTeam(this.props.currentTeamId, pageNum, USERS_PER_PAGE * 2).then(() => {
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

    render() {
        const body = (
            <List
                addValue={this.addValue}
                currentUserId={this.props.currentUserId}
                handleDelete={this.handleDelete}
                handlePageChange={this.handlePageChange}
                handleSubmit={this.handleSubmit}
                isExistingChannel={this.props.isExistingChannel}
                loading={this.state.loadingUsers}
                saving={this.state.saving}
                search={this.search}
                selectedItemRef={this.selectedItemRef}
                totalCount={this.props.totalCount}
                users={this.props.users}
                values={this.state.values}
            />
        );

        return (
            <Modal
                dialogClassName='a11y__modal more-modal more-direct-channels'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
                onEntered={this.loadModalData}
                role='dialog'
                aria-labelledby='moreDmModalLabel'
                id='moreDmModal'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='moreDmModalLabel'
                    >
                        <FormattedMessage
                            id='more_direct_channels.title'
                            defaultMessage='Direct Messages'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body
                    role='application'
                >
                    {body}
                </Modal.Body>
                <Modal.Footer className='modal-footer--invisible'>
                    <button
                        id='closeModalButton'
                        type='button'
                        className='btn btn-link'
                    >
                        <FormattedMessage
                            id='general_button.close'
                            defaultMessage='Close'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
