// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {debounce} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';
import {isEmail} from 'mattermost-redux/utils/helpers';
import {filterProfilesStartingWithTerm} from 'mattermost-redux/utils/user_utils';

import {focusElement} from 'utils/a11y_utils';
import {isMembershipPolicyEnforced} from 'utils/channel_utils';

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
type Backdrop = 'static' | boolean;

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
            guestMagicLink: boolean,
        ) => Promise<ActionResult<InviteResults>>;
        sendMembersInvites: (
            teamId: string,
            users: UserProfile[],
            emails: string[],
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
    canInviteGuestsWithMagicLink: boolean;
    onExited: () => void;
    channelToInvite?: Channel;
    initialValue?: string;
    inviteAsGuest?: boolean;
    focusOriginElement?: string;
};

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
    useGuestMagicLink: boolean;

    // Policy-matching invite candidates for a private team governed by a
    // membership policy. Loaded once from the server so non-qualifying users
    // never appear in the picker; the term search runs locally over this set.
    abacCandidates: UserProfile[];
};

export default class InvitationModal extends React.PureComponent<Props, State> {
    defaultState: State = deepFreeze({
        view: View.INVITE,
        termWithoutResults: null,
        invite: initializeInviteState(this.props.initialValue || '', this.props.inviteAsGuest, this.props.canInviteGuestsWithMagicLink),
        result: defaultResultState,
        show: true,
        useGuestMagicLink: false,
        abacCandidates: [],
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

    componentDidMount() {
        // A private team governed by a membership policy is a hard gate: only
        // policy-matching users may be invited. Preload that set so the picker
        // never surfaces a non-qualifying user. Public governed teams are
        // advisory — the normal search is left untouched.
        if (this.isStrictlyFilteredTeam()) {
            this.loadAbacCandidates();
        }
    }

    componentDidUpdate(prevProps: Props) {
        // The team prop may arrive after mount (e.g. read-replica lag means
        // policy_enforced=false at mount, then the Redux store catches up).
        // Trigger a fresh candidate load whenever the team transitions from
        // ungoverned/advisory to strictly filtered and the buffer is still empty.
        if (!this.isStrictlyFilteredProp(prevProps) && this.isStrictlyFilteredTeam() && this.state.abacCandidates.length === 0) {
            this.loadAbacCandidates();
        }
    }

    isTeamMembershipGoverned = (): boolean => {
        return Boolean(this.props.currentTeam?.policy_enforced);
    };

    // Public team (open invite) governance is advisory; everything else is
    // strict. Mirrors the server's privacy test, which keys on allow_open_invite
    // alone (master's open-directory model).
    isStrictlyFilteredTeam = (): boolean => {
        return this.isStrictlyFilteredProp(this.props);
    };

    isStrictlyFilteredProp = (props: Props): boolean => {
        const team = props.currentTeam;
        if (!team?.policy_enforced) {
            return false;
        }
        return !team.allow_open_invite;
    };

    loadAbacCandidates = async () => {
        if (!this.props.currentTeam) {
            return;
        }
        const teamId = this.props.currentTeam.id;
        const perPage = 100;
        const hardCap = 1000;
        const collected: UserProfile[] = [];
        const seen = new Set<string>();
        let cursorId = '';
        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                // eslint-disable-next-line no-await-in-loop
                const profiles = await Client4.getProfilesMatchingTeamPolicy(teamId, perPage, cursorId);
                if (!profiles || profiles.length === 0) {
                    break;
                }
                for (const profile of profiles) {
                    if (!seen.has(profile.id)) {
                        seen.add(profile.id);
                        collected.push(profile);
                    }
                }
                if (profiles.length < perPage || collected.length >= hardCap) {
                    break;
                }
                cursorId = profiles[profiles.length - 1].id;
            }
        } catch {
            // Leave the buffer empty; the strict picker then shows no candidates
            // rather than risk surfacing a non-qualifying user.
        }
        this.setState({abacCandidates: collected});
    };

    handleHide = () => {
        this.setState({show: false});
    };

    handleExit = () => {
        if (this.props.focusOriginElement) {
            focusElement(this.props.focusOriginElement, true);
        }
        this.props.onExited?.();
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

    toggleGuestMagicLink = () => {
        this.setState((state) => ({
            ...state,
            useGuestMagicLink: !state.useGuestMagicLink,
        }));
    };

    invite = async () => {
        if (!this.props.currentTeam) {
            return;
        }
        const inviteAs = this.state.invite.inviteType;

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
                this.state.useGuestMagicLink,
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

    // Filter channels based on the current invite type and search term
    filterChannels = (channels: Channel[], isGuestInvite: boolean, searchTerm: string = '') => {
        return channels.filter((channel) => {
            // For guest invites, filter out channels whose policy gates
            // membership. Permission-only policies (e.g. file upload
            // restrictions) do not block guest invites — the server-side
            // gate in `prepareInviteGuestsToChannels` reads the same bit.
            if (isGuestInvite && isMembershipPolicyEnforced(channel)) {
                return false;
            }

            // If there's a search term, filter by name match
            if (searchTerm) {
                const lowerSearchTerm = searchTerm.toLowerCase();
                return channel.display_name.toLowerCase().includes(lowerSearchTerm) ||
                       channel.name.toLowerCase().includes(lowerSearchTerm);
            }

            return true;
        });
    };

    channelsLoader = async (value: string) => {
        const isGuestInvite = this.state.invite.inviteType === InviteType.GUEST;

        // If there's a search term, search the channels from the server
        if (value) {
            this.debouncedSearchChannels(value);
        }

        // Apply filtering to the channels
        return this.filterChannels(
            this.props.invitableChannels,
            isGuestInvite,
            value,
        );
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
        // Strict (private + policy) teams: invite only from the server-matched
        // candidate set, filtered locally by the typed term. Never falls back to
        // the unfiltered profile search.
        if (this.isStrictlyFilteredTeam()) {
            const matches = term ? filterProfilesStartingWithTerm(this.state.abacCandidates, term) : this.state.abacCandidates;
            callback(matches.slice(0, 20));
            return;
        }

        if (
            this.state.termWithoutResults &&
            term.startsWith(this.state.termWithoutResults)
        ) {
            callback([]);
            return;
        }
        try {
            this.debouncedSearchProfiles(term, callback);
        } catch {
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
                membershipPolicyEnforced={this.isTeamMembershipGoverned()}
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
                useGuestMagicLink={this.state.useGuestMagicLink}
                toggleGuestMagicLink={this.toggleGuestMagicLink}
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
            <GenericModal
                id='invitationModal'
                dataTestId='invitationModal'
                className='InvitationModal a11y__modal modal--overflow'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
                backdrop={this.getBackdrop()}
                ariaLabelledby='invitation_modal_title'
                compassDesign={true}
                showCloseButton={false}
                showHeader={false}
            >
                {view}
            </GenericModal>
        );
    }
}
