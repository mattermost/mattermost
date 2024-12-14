// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessages} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {debounce} from 'mattermost-redux/actions/helpers';
import type {ActionResult} from 'mattermost-redux/types/actions';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';
import {isEmail} from 'mattermost-redux/utils/helpers';

import {trackEvent} from 'actions/telemetry_actions';

import {InviteType} from './invite_as';
import InviteView, {initializeInviteState} from './invite_view';
import type {InviteState} from './invite_view';
import NoPermissionsView from './no_permissions_view';
import ResultView, {defaultResultState} from './result_view';
import type {ResultState, InviteResults} from './result_view';

import './invitation_modal.scss';

// 'static' means backdrop clicks do not close
// true means backdrop clicks do close
// false means no backdrop
type Backdrop = 'static' | boolean

const messages = defineMessages({
    notValidChannel: {
        id: 'invitation-modal.confirm.not-valid-channel',
        defaultMessage: 'Does not match a valid channel name.',
    },
    notValidUserOrEmail: {
        id: 'invitation-modal.confirm.not-valid-user-or-email',
        defaultMessage: 'Does not match a valid user or email.',
    },
});

export type Props = {
    actions: {
        searchChannels: (teamId: string, term: string) => Promise<ActionResult<Channel[]>>;
        regenerateTeamInviteId: (teamId: string) => void;

        searchProfiles: (term: string, options?: Record<string, string>) => Promise<ActionResult<UserProfile[]>>;
        sendGuestsInvites: (
            currentTeamId: string,
            channels: Channel[],
            users: UserProfile[],
            emails: string[],
            message: string,
        ) => Promise<ActionResult<InviteResults>>;
        sendMembersInvites: (
            teamId: string,
            users: UserProfile[],
            emails: string[]
        ) => Promise<ActionResult<InviteResults>>;
        sendMembersInvitesToChannels: (
            teamId: string,
            channels: Channel[],
            users: UserProfile[],
            emails: string[],
            message: string,
        ) => Promise<ActionResult<InviteResults>>;
    };
    currentTeam?: Team;
    currentChannel?: Channel;
    townSquareDisplayName: string;
    invitableChannels: Channel[];
    emailInvitationsEnabled: boolean;
    isAdmin: boolean;
    isCloud: boolean;
    canAddUsers: boolean;
    canInviteGuests: boolean;
    onExited: () => void;
    channelToInvite?: Channel;
    initialValue?: string;
    inviteAsGuest?: boolean;
    roleForTrackFlow: {started_by_role: string};
}

export const View = {
    INVITE: 'INVITE',
    RESULT: 'RESULT',
} as const;

type View = typeof View[keyof typeof View];

type State = {
    view: View;
    invite: InviteState;
    result: ResultState;
    termWithoutResults: string | null;
    show: boolean;
};

export default class InvitationModal extends React.PureComponent<Props, State> {
    defaultState: State = deepFreeze({
        view: View.INVITE,
        termWithoutResults: null,
        invite: initializeInviteState(this.props.initialValue || '', this.props.inviteAsGuest),
        result: defaultResultState,
        show: true,
    });
    constructor(props: Props) {
        super(props);

        const defaultStateChannels = this.defaultState.invite.inviteChannels.channels;

        this.state = {
            ...this.defaultState,
            invite: {
                ...this.defaultState.invite,
                inviteType: (!props.canAddUsers && props.canInviteGuests) ? InviteType.GUEST : this.defaultState.invite.inviteType,
                inviteChannels: {
                    ...this.defaultState.invite.inviteChannels,
                    channels: props.channelToInvite ? [...defaultStateChannels, props.channelToInvite] : defaultStateChannels,
                },
            },
        };
    }

    handleHide = () => {
        this.setState({show: false});
    };

    toggleCustomMessage = () => {
        this.setState((state) => ({
            ...state,
            invite: {
                ...state.invite,
                customMessage: {
                    ...state.invite.customMessage,
                    open: !state.invite.customMessage.open,
                },
            },
        }));
    };

    setCustomMessage = (message: string) => {
        this.setState((state) => ({
            ...state,
            invite: {
                ...state.invite,
                customMessage: {
                    ...state.invite.customMessage,
                    message,
                },
            },
        }));
    };

    setInviteAs = (inviteType: InviteType) => {
        if (this.state.invite.inviteType !== inviteType) {
            this.setState((state) => ({
                ...state,
                invite: {
                    ...this.state.invite,
                    inviteType,
                },
            }));
        }
    };

    invite = async () => {
        if (!this.props.currentTeam) {
            return;
        }
        const inviteAs = this.state.invite.inviteType;
        if (inviteAs === InviteType.MEMBER && this.props.isCloud) {
            trackEvent('cloud_invite_users', 'click_send_invitations', {num_invitations: this.state.invite.usersEmails.length, ...this.props.roleForTrackFlow});
        }
        trackEvent('invite_users', 'click_invite', this.props.roleForTrackFlow);

        const users: UserProfile[] = [];
        const emails: string[] = [];
        for (const userOrEmail of this.state.invite.usersEmails) {
            if (typeof userOrEmail === 'string' && isEmail(userOrEmail)) {
                emails.push(userOrEmail);
            } else if (typeof userOrEmail !== 'string') {
                users.push(userOrEmail);
            }
        }
        let invites: InviteResults = {notSent: [], sent: []};
        if (inviteAs === InviteType.MEMBER) {
            if (this.props.channelToInvite) {
                // this call is to invite as member but to (a) channel(s) directly
                const result = await this.props.actions.sendMembersInvitesToChannels(
                    this.props.currentTeam.id,
                    this.state.invite.inviteChannels.channels,
                    users,
                    emails,
                    this.state.invite.customMessage.open ? this.state.invite.customMessage.message : '',
                );
                invites = result.data!;
            } else {
                const result = await this.props.actions.sendMembersInvites(this.props.currentTeam.id, users, emails);
                invites = result.data!;
            }
        } else if (inviteAs === InviteType.GUEST) {
            const result = await this.props.actions.sendGuestsInvites(
                this.props.currentTeam.id,
                this.state.invite.inviteChannels.channels,
                users,
                emails,
                this.state.invite.customMessage.open ? this.state.invite.customMessage.message : '',
            );
            invites = result.data!;
        }

        if (this.state.invite.usersEmailsSearch !== '') {
            invites.notSent.push({
                text: this.state.invite.usersEmailsSearch,
                reason: messages.notValidUserOrEmail,
            });
        }

        if (inviteAs === InviteType.GUEST && this.state.invite.inviteChannels.search !== '') {
            invites.notSent.push({
                text: this.state.invite.inviteChannels.search,
                reason: messages.notValidChannel,
            });
        }

        this.setState((state: State) => ({
            view: View.RESULT,
            result: {
                ...state.result,
                sent: invites.sent,
                notSent: invites.notSent,
            },
        }));
    };

    inviteMore = () => {
        this.setState((state: State) => ({
            view: View.INVITE,
            invite: {
                ...initializeInviteState(),
                inviteType: state.invite.inviteType,
                customMessage: state.invite.customMessage,
                inviteChannels: state.invite.inviteChannels,
            },
            result: defaultResultState,
            termWithoutResults: null,
        }));
    };

    debouncedSearchChannels = debounce((term) => this.props.currentTeam && this.props.actions.searchChannels(this.props.currentTeam.id, term), 150);

    channelsLoader = async (value: string) => {
        if (!value) {
            return this.props.invitableChannels;
        }

        this.debouncedSearchChannels(value);
        return this.props.invitableChannels.filter((channel) => {
            return channel.display_name.toLowerCase().startsWith(value.toLowerCase()) || channel.name.toLowerCase().startsWith(value.toLowerCase());
        });
    };

    onChannelsChange = (channels: Channel[]) => {
        this.setState((state) => ({
            ...state,
            invite: {
                ...state.invite,
                inviteChannels: {
                    ...state.invite.inviteChannels,
                    channels: channels ?? [],
                },
            },
        }));
    };

    onChannelsInputChange = (search: string) => {
        this.setState((state) => ({
            ...state,
            invite: {
                ...state.invite,
                inviteChannels: {
                    ...state.invite.inviteChannels,
                    search,
                },
            },
        }));
    };

    debouncedSearchProfiles = debounce((term: string, callback: (users: UserProfile[]) => void) => {
        this.props.actions.searchProfiles(term).
            then(({data}: ActionResult<UserProfile[]>) => {
                callback(data!);
                if (data!.length === 0) {
                    this.setState({termWithoutResults: term});
                } else {
                    this.setState({termWithoutResults: null});
                }
            }).
            catch(() => {
                callback([]);
            });
    }, 150);

    usersLoader = (term: string, callback: (users: UserProfile[]) => void): Promise<UserProfile[]> | undefined => {
        if (
            this.state.termWithoutResults &&
            term.startsWith(this.state.termWithoutResults)
        ) {
            callback([]);
            return;
        }
        try {
            this.debouncedSearchProfiles(term, callback);
        } catch (error) {
            callback([]);
        }
    };

    onChangeUsersEmails = (usersEmails: Array<UserProfile | string>) => {
        this.setState((state: State) => ({
            ...state,
            invite: {
                ...state.invite,
                usersEmails,
            },
        }));
    };

    onUsersInputChange = (usersEmailsSearch: string) => {
        this.setState((state: State) => ({
            ...state,
            invite: {
                ...state.invite,
                usersEmailsSearch,
            },
        }));
    };

    getBackdrop = (): Backdrop => {
        // 'static' means backdrop clicks do not close
        // true means backdrop clicks do close
        // false means no backdrop
        if (this.state.view === View.RESULT || (!this.props.canAddUsers && !this.props.canInviteGuests)) {
            return true;
        }

        const emptyInvites = this.state.invite.usersEmails.length === 0 && this.state.invite.usersEmailsSearch === '';
        if (!emptyInvites) {
            return 'static';
        } else if (this.state.invite.inviteType === InviteType.GUEST) {
            if (this.state.invite.inviteChannels.channels.length !== 0 ||
                this.state.invite.inviteChannels.search !== ''
            ) {
                return 'static';
            }
        }
        return true;
    };

    render() {
        if (!this.props.currentTeam) {
            return null;
        }

        let view = (
            <InviteView
                setInviteAs={this.setInviteAs}
                invite={this.invite}
                setCustomMessage={this.setCustomMessage}
                channelsLoader={this.channelsLoader}
                toggleCustomMessage={this.toggleCustomMessage}
                regenerateTeamInviteId={this.props.actions.regenerateTeamInviteId}
                currentTeam={this.props.currentTeam}
                onChannelsInputChange={this.onChannelsInputChange}
                onChannelsChange={this.onChannelsChange}
                currentChannel={this.props.currentChannel}
                townSquareDisplayName={this.props.townSquareDisplayName}
                isAdmin={this.props.isAdmin}
                usersLoader={this.usersLoader}
                emailInvitationsEnabled={this.props.emailInvitationsEnabled}
                onChangeUsersEmails={this.onChangeUsersEmails}
                onUsersInputChange={this.onUsersInputChange}
                isCloud={this.props.isCloud}
                canAddUsers={this.props.canAddUsers}
                canInviteGuests={this.props.canInviteGuests}
                headerClass='InvitationModal__header'
                footerClass='InvitationModal__footer'
                onClose={this.handleHide}
                channelToInvite={this.props.channelToInvite}
                {...this.state.invite}
            />
        );
        if (this.state.view === View.RESULT) {
            view = (
                <ResultView
                    inviteType={this.state.invite.inviteType}
                    currentTeamName={this.props.currentTeam.display_name}
                    onDone={this.handleHide}
                    inviteMore={this.inviteMore}
                    headerClass='InvitationModal__header'
                    footerClass='InvitationModal__footer'
                    {...this.state.result}
                />
            );
        }
        if (!this.props.canInviteGuests && !this.props.canAddUsers) {
            view = (
                <NoPermissionsView
                    footerClass='InvitationModal__footer'
                    onDone={this.handleHide}
                />
            );
        }

        return (
            <Modal
                id='invitationModal'
                data-testid='invitationModal'
                dialogClassName='a11y__modal modal--overflow'
                className='InvitationModal'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.props.onExited}
                role='none'
                backdrop={this.getBackdrop()}
                aria-modal='true'
                aria-labelledby='invitation_modal_title'
            >
                {view}
            </Modal>
        );
    }
}
