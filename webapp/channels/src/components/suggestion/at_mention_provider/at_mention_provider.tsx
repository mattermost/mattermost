// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {CreationOutlineIcon} from '@mattermost/compass-icons/components';
import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {Filters} from 'mattermost-redux/selectors/entities/users';
import {makeGetProfilesInChannel} from 'mattermost-redux/selectors/entities/users';
import {makeAddLastViewAtToProfiles} from 'mattermost-redux/selectors/entities/utils';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {getSuggestionsSplitBy, getSuggestionsSplitByMultiple} from 'mattermost-redux/utils/user_utils';

import store from 'stores/redux_store';

import {Constants} from 'utils/constants';

import type {GlobalState} from 'types/store';

import AtMentionSuggestion from './at_mention_suggestion';

import type {ResultsCallback} from '../provider';
import Provider from '../provider';
import type {Loading, ProviderResultsGroup} from '../suggestion_results';

const profilesInChannelOptions = {active: true};
const regexForAtMention = /(?:^|\W)([@＠]([\p{L}\d\-_. ]*))$/iu;

type UserProfileWithLastViewAt = UserProfile & {last_viewed_at?: number};

type CreatedProfile = UserProfile & {
    isCurrentUser?: boolean;
    last_viewed_at?: number;
};

type SpecialMention = {
    username: string;
}

export type Props = {
    currentUserId: string;
    channelId: string;
    autocompleteUsersInChannel: (prefix: string) => Promise<ActionResult>;
    useChannelMentions: boolean;
    autocompleteGroups: Group[] | null;
    searchAssociatedGroupsForReference: (prefix: string) => Promise<{data: any}>;
    priorityProfiles: UserProfile[] | undefined;
}

// The AtMentionProvider provides matches for at mentions, including @here, @channel, @all,
// users in the channel and users not in the channel. It mixes together results from the local
// store with results fetched from the server.
export default class AtMentionProvider extends Provider {
    public currentUserId: string;
    public channelId: string;
    public autocompleteUsersInChannel: (prefix: string) => Promise<ActionResult>;
    public useChannelMentions: boolean;
    public autocompleteGroups: Group[] | null;
    public searchAssociatedGroupsForReference: (prefix: string) => Promise<{data: any}>;
    public priorityProfiles: UserProfile[] | undefined;

    public data: any;
    public lastCompletedWord: string;
    public lastPrefixWithNoResults: string;
    public triggerCharacter: string = '@';
    public getProfilesInChannel: (state: GlobalState, channelId: string, filters?: Filters | undefined) => UserProfile[];
    public addLastViewAtToProfiles: (state: GlobalState, profiles: UserProfile[]) => UserProfileWithLastViewAt[];

    constructor(props: Props) {
        super();

        const {currentUserId, channelId, autocompleteUsersInChannel, useChannelMentions, autocompleteGroups, searchAssociatedGroupsForReference, priorityProfiles} = props;

        this.currentUserId = currentUserId;
        this.channelId = channelId;
        this.autocompleteUsersInChannel = autocompleteUsersInChannel;
        this.useChannelMentions = useChannelMentions;
        this.autocompleteGroups = autocompleteGroups;
        this.searchAssociatedGroupsForReference = searchAssociatedGroupsForReference;
        this.priorityProfiles = priorityProfiles;

        this.data = null;
        this.lastCompletedWord = '';
        this.lastPrefixWithNoResults = '';
        this.triggerCharacter = '@';
        this.getProfilesInChannel = makeGetProfilesInChannel();
        this.addLastViewAtToProfiles = makeAddLastViewAtToProfiles();
    }

    setProps({currentUserId, channelId, autocompleteUsersInChannel, useChannelMentions, autocompleteGroups, searchAssociatedGroupsForReference, priorityProfiles}: Props) {
        this.currentUserId = currentUserId;
        this.channelId = channelId;
        this.autocompleteUsersInChannel = autocompleteUsersInChannel;
        this.useChannelMentions = useChannelMentions;
        this.autocompleteGroups = autocompleteGroups;
        this.searchAssociatedGroupsForReference = searchAssociatedGroupsForReference;
        this.priorityProfiles = priorityProfiles;
    }

    // specialMentions matches one of @here, @channel or @all, unless using /msg.
    specialMentions() {
        if (this.latestPrefix.startsWith('/msg') || !this.useChannelMentions) {
            return [];
        }

        return ['here', 'channel', 'all'].filter((item) =>
            item.startsWith(this.latestPrefix),
        ).map((name) => ({
            username: name,
        }));
    }

    // retrieves the parts of the profile that should be checked
    // against the term
    getProfileSuggestions(profile: UserProfile) {
        const profileSuggestions: string[] = [];
        if (!profile) {
            return profileSuggestions;
        }

        if (profile.username) {
            const usernameSuggestions = getSuggestionsSplitByMultiple(profile.username.toLowerCase(), Constants.AUTOCOMPLETE_SPLIT_CHARACTERS);
            profileSuggestions.push(...usernameSuggestions);
        }
        [profile.first_name, profile.last_name, profile.nickname].forEach((property) => {
            const suggestions = getSuggestionsSplitBy(property.toLowerCase(), ' ');
            profileSuggestions.push(...suggestions);
        });
        profileSuggestions.push(profile.first_name.toLowerCase() + ' ' + profile.last_name.toLowerCase());

        return profileSuggestions;
    }

    // retrieves the parts of the group mention that should be checked
    // against the term
    getGroupSuggestions(group: Group) {
        const groupSuggestions: string[] = [];
        if (!group) {
            return groupSuggestions;
        }

        if (group.name) {
            const groupnameSuggestions = getSuggestionsSplitByMultiple(group.name.toLowerCase(), Constants.AUTOCOMPLETE_SPLIT_CHARACTERS);
            groupSuggestions.push(...groupnameSuggestions);
        }

        const suggestions = getSuggestionsSplitBy(group.display_name.toLowerCase(), ' ');
        groupSuggestions.push(...suggestions);

        groupSuggestions.push(group.display_name.toLowerCase());
        return groupSuggestions;
    }

    // normalizeString performs a unicode normalization to a string
    normalizeString(name: string) {
        return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // filterProfile constrains profiles to those matching the latest prefix.
    filterProfile(profile: UserProfile | UserProfileWithLastViewAt) {
        if (!profile) {
            return false;
        }

        const prefixLower = this.latestPrefix.toLowerCase();
        const profileSuggestions = this.getProfileSuggestions(profile);
        return profileSuggestions.some((suggestion) =>
            this.normalizeString(suggestion).startsWith(this.normalizeString(prefixLower)),
        );
    }

    // filterGroup constrains group mentions to those matching the latest prefix.
    filterGroup(group: Group) {
        if (!group) {
            return false;
        }

        const prefixLower = this.latestPrefix.toLowerCase();
        const groupSuggestions = this.getGroupSuggestions(group);
        return groupSuggestions.some((suggestion) => suggestion.startsWith(prefixLower));
    }

    getProfilesWithLastViewAtInChannel() {
        const state = store.getState();

        const profilesInChannel = this.getProfilesInChannel(state, this.channelId, profilesInChannelOptions);
        const profilesWithLastViewAtInChannel = this.addLastViewAtToProfiles(state, profilesInChannel);

        return profilesWithLastViewAtInChannel;
    }

    // localMembers matches up to 25 local results from the store before the server has responded.
    localMembers() {
        const localMembers = this.getProfilesWithLastViewAtInChannel().
            filter((profile) => this.filterProfile(profile)).
            map((profile) => this.createFromProfile(profile)).
            splice(0, 25);

        return localMembers;
    }

    filterPriorityProfiles() {
        if (!this.priorityProfiles) {
            return [];
        }

        const priorityProfiles = this.priorityProfiles.
            filter((profile) => this.filterProfile(profile)).
            map((profile) => this.createFromProfile(profile));

        return priorityProfiles;
    }

    // localGroups matches up to 25 local results from the store
    localGroups() {
        if (!this.autocompleteGroups) {
            return [];
        }

        const localGroups = this.autocompleteGroups.
            filter((group) => this.filterGroup(group)).
            sort((a, b) => a.name.localeCompare(b.name)).
            splice(0, 25);

        return localGroups;
    }

    // remoteMembers matches the users listed in the channel by the server.
    remoteMembers() {
        if (!this.data) {
            return [];
        }

        const remoteMembers = (this.data.users || []).
            filter((profile: UserProfileWithLastViewAt) => this.filterProfile(profile)).
            map((profile: UserProfileWithLastViewAt) => this.createFromProfile(profile));

        return remoteMembers;
    }

    // remoteGroups matches the users listed in the channel by the server.
    remoteGroups() {
        if (!this.data) {
            return [];
        }
        const remoteGroups = ((this.data.groups || []) as Group[]).
            filter((group: Group) => this.filterGroup(group));

        return remoteGroups;
    }

    // remoteNonMembers matches users listed as not in the channel by the server.
    // listed in the channel from local results.
    remoteNonMembers(): CreatedProfile[] {
        if (!this.data) {
            return [];
        }

        return (this.data.out_of_channel || []).
            filter((profile: UserProfileWithLastViewAt) => this.filterProfile(profile));
    }

    items() {
        const priorityProfilesIds: Record<string, boolean> = {};
        const priorityProfiles = this.filterPriorityProfiles();

        priorityProfiles.forEach((member) => {
            priorityProfilesIds[member.id] = true;
        });

        const specialMentions = this.specialMentions();
        const localMembers = this.localMembers().filter((member) => !priorityProfilesIds[member.id]);

        const localUserIds: Record<string, boolean> = {};

        localMembers.forEach((member) => {
            localUserIds[member.id] = true;
        });

        const remoteMembers = this.remoteMembers().filter((member: CreatedProfile) => !localUserIds[member.id] && !priorityProfilesIds[member.id]);

        // comparator which prioritises users with usernames starting with search term
        const orderUsers = (a: CreatedProfile, b: CreatedProfile) => {
            const aStartsWith = a.username.startsWith(this.latestPrefix);
            const bStartsWith = b.username.startsWith(this.latestPrefix);

            if (aStartsWith && !bStartsWith) {
                return -1;
            } else if (!aStartsWith && bStartsWith) {
                return 1;
            }

            // Sort recently viewed channels first
            if (a.last_viewed_at && b.last_viewed_at) {
                return b.last_viewed_at - a.last_viewed_at;
            } else if (a.last_viewed_at) {
                return -1;
            } else if (b.last_viewed_at) {
                return 1;
            }

            return a.username.localeCompare(b.username);
        };

        // Combine the local and remote members, sorting to mix the results together.
        const localAndRemoteMembers = localMembers.concat(remoteMembers).sort(orderUsers);

        // Get agents - these are already User objects from the backend
        // Only show agents if bridge is enabled (indicated by presence of agents data)
        let agents: CreatedProfile[] = [];
        if (this.data && this.data.agents && Array.isArray(this.data.agents) && this.data.agents.length > 0) {
            const agentUsers = this.data.agents as UserProfileWithLastViewAt[];
            agents = agentUsers.
                filter((user: UserProfileWithLastViewAt) => this.filterProfile(user)).
                map((user: UserProfileWithLastViewAt) => this.createFromProfile(user)).
                sort(orderUsers);
        }

        // handle groups
        const localGroups = this.localGroups();

        const localGroupIds: Record<string, boolean> = {};
        localGroups.forEach((group) => {
            localGroupIds[group.id] = true;
        });

        const remoteGroups = this.remoteGroups().filter((group) => !localGroupIds[group.id]);

        // comparator which prioritises users with usernames starting with search term
        const orderGroups = (a: Group, b: Group) => {
            const aStartsWith = a.name.startsWith(this.latestPrefix);
            const bStartsWith = b.name.startsWith(this.latestPrefix);

            if (aStartsWith && bStartsWith) {
                return a.name.localeCompare(b.name);
            }
            if (aStartsWith) {
                return -1;
            }
            if (bStartsWith) {
                return 1;
            }
            return a.name.localeCompare(b.name);
        };

        // Combine the local and remote groups, sorting to mix the results together.
        const localAndRemoteGroups = localGroups.concat(remoteGroups).sort(orderGroups);

        const remoteNonMembers = this.remoteNonMembers().
            filter((member) => !localUserIds[member.id]).
            sort(orderUsers);

        const items = [];

        if (priorityProfiles.length > 0 || localAndRemoteMembers.length > 0) {
            items.push(membersGroup([...priorityProfiles, ...localAndRemoteMembers]));
        }
        if (agents.length > 0) {
            items.push(agentsGroup(agents));
        }
        if (localAndRemoteGroups.length > 0) {
            items.push(groupsGroup(localAndRemoteGroups));
        }
        if (specialMentions.length > 0) {
            items.push(specialMentionsGroup(specialMentions));
        }
        if (remoteNonMembers.length > 0) {
            items.push(nonMembersGroup(remoteNonMembers));
        }

        return items;
    }

    // updateMatches invokes the resultCallback with the metadata for rendering at mentions
    updateMatches(resultCallback: ResultsCallback<unknown>, groups: Array<ProviderResultsGroup<UserProfile | Group | SpecialMention | Loading>>, matchedPretext: string) {
        if (groups.length === 0) {
            this.lastPrefixWithNoResults = this.latestPrefix;
        } else if (this.lastPrefixWithNoResults === this.latestPrefix) {
            this.lastPrefixWithNoResults = '';
        }

        resultCallback({
            matchedPretext,
            groups,
        });
    }

    handlePretextChanged(pretext: string, resultCallback: ResultsCallback<unknown>) {
        const captured = regexForAtMention.exec(pretext.toLowerCase());
        if (!captured) {
            return false;
        }

        const matchedPretext = captured[1];
        const prefix = captured[2];

        if (this.lastCompletedWord && prefix.trim().startsWith(this.lastCompletedWord.trim())) {
            // It appears we're still matching a channel handle that we already completed
            return false;
        }

        if (this.lastPrefixWithNoResults && prefix.startsWith(this.lastPrefixWithNoResults)) {
            // Just give up since we know it won't return any results
            return false;
        }

        this.startNewRequest(prefix);
        this.updateMatches(resultCallback, this.items(), matchedPretext);

        // If we haven't gotten server-side results in 500 ms, add the loading indicator.
        let showLoadingIndicator: NodeJS.Timeout | null = setTimeout(() => {
            if (this.shouldCancelDispatch(prefix)) {
                return;
            }

            this.updateMatches(resultCallback, [...this.items(), ...[otherMembersGroup()]], matchedPretext);

            showLoadingIndicator = null;
        }, 500);

        // Query the server for remote results to add to the local results.
        this.autocompleteUsersInChannel(prefix).then(({data}) => {
            if (showLoadingIndicator) {
                clearTimeout(showLoadingIndicator);
            }
            if (this.shouldCancelDispatch(prefix)) {
                return;
            }
            this.data = data;
            this.searchAssociatedGroupsForReference(prefix).then((groupsData) => {
                if (this.data && groupsData && groupsData.data) {
                    this.data.groups = groupsData.data;
                }
                this.updateMatches(resultCallback, this.items(), matchedPretext);
            });
        });

        return true;
    }

    handleCompleteWord(term: string) {
        const termWithoutAt = term.replace(/^[@＠]/, '');
        this.lastCompletedWord = termWithoutAt;
        this.lastPrefixWithNoResults = '';
    }

    createFromProfile(profile: UserProfile | UserProfileWithLastViewAt): CreatedProfile {
        if (profile.id === this.currentUserId) {
            return {
                ...profile,
                isCurrentUser: true,
            };
        }

        return profile;
    }
}

export function membersGroup(items: CreatedProfile[]) {
    return {
        key: 'members',
        label: defineMessage({id: 'suggestion.mention.members', defaultMessage: 'Channel Members'}),
        items,
        terms: items.map((profile) => '@' + profile.username),
        component: AtMentionSuggestion,
    };
}

export function agentsGroup(items: CreatedProfile[]) {
    return {
        key: 'agents',
        label: defineMessage({id: 'suggestion.mention.agents', defaultMessage: 'Agents'}),
        icon: <CreationOutlineIcon size={16}/>,
        items,
        terms: items.map((profile) => '@' + profile.username),
        component: AtMentionSuggestion,
    };
}

export function groupsGroup(items: Group[]) {
    return {
        key: 'groups',
        label: defineMessage({id: 'suggestion.search.group', defaultMessage: 'Group Mentions'}),
        items,
        terms: items.map((group) => '@' + group.name),
        component: AtMentionSuggestion,
    };
}

export function specialMentionsGroup(items: Array<{username: string}>) {
    return {
        key: 'specialMentions',
        label: defineMessage({id: 'suggestion.mention.special', defaultMessage: 'Special Mentions'}),
        items,
        terms: items.map((item) => '@' + item.username),
        component: AtMentionSuggestion,
    };
}

export function nonMembersGroup(items: CreatedProfile[]) {
    return {
        key: 'nonMembers',
        label: defineMessage({id: 'suggestion.mention.nonmembers', defaultMessage: 'Not in Channel'}),
        items,
        terms: items.map((item) => '@' + item.username),
        component: AtMentionSuggestion,
    };
}

export function otherMembersGroup() {
    return {
        key: 'otherMembers',
        label: defineMessage({id: 'suggestion.mention.moremembers', defaultMessage: 'Other Members'}),
        items: [{
            loading: true as const,
        }],
        terms: [''],
        component: AtMentionSuggestion,
    };
}
