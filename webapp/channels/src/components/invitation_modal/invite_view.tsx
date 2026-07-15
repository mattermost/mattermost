// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';
import type {LockProfileFieldsSetting} from '@mattermost/types/config';
import type {MemberInviteProfile, Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import useCopyText from 'components/common/hooks/useCopyText';
import UsersEmailsInput from 'components/widgets/inputs/users_emails_input';

import {Constants} from 'utils/constants';
import {canPresetMemberInviteProfiles, getEmailsToPreset, getProfileForEmail, profileHasInput} from 'utils/member_invite_profiles';
import {getSiteURL} from 'utils/url';
import {isValidUsername} from 'utils/utils';

import AddToChannels, {defaultCustomMessage, defaultInviteChannels} from './add_to_channels';
import type {CustomMessageProps, InviteChannels} from './add_to_channels';
import InviteAs, {InviteType} from './invite_as';
import MemberProfileInputs from './member_profile_inputs';
import OverageUsersBannerNotice from './overage_users_banner_notice';

import './invite_view.scss';

export const initializeInviteState = (initialSearchValue = '', inviteAsGuest = false, canInviteGuestsWithMagicLink = false): InviteState => {
    return deepFreeze({
        inviteType: inviteAsGuest ? InviteType.GUEST : InviteType.MEMBER,
        customMessage: defaultCustomMessage,
        inviteChannels: defaultInviteChannels,
        usersEmails: [],
        usersEmailsSearch: initialSearchValue,
        canInviteGuestsWithMagicLink,
        profiles: {},
    });
};

export type InviteState = {
    customMessage: CustomMessageProps;
    inviteType: InviteType;
    inviteChannels: InviteChannels;
    usersEmails: Array<UserProfile | string>;
    usersEmailsSearch: string;
    canInviteGuestsWithMagicLink: boolean;
    profiles: Record<string, MemberInviteProfile>;
};

export type Props = InviteState & {
    setInviteAs: (inviteType: InviteType) => void;
    onChannelsChange: (channels: Channel[]) => void;
    onChannelsInputChange: (channelsInputValue: string) => void;
    currentTeam: Team;
    currentChannel?: Channel;
    setCustomMessage: (message: string) => void;
    toggleCustomMessage: () => void;
    channelsLoader: (value: string, callback?: (channels: Channel[]) => void) => Promise<Channel[]>;
    regenerateTeamInviteId: (teamId: string) => void;
    isAdmin: boolean;
    usersLoader: (value: string, callback: (users: UserProfile[]) => void) => Promise<UserProfile[]> | undefined;
    onChangeUsersEmails: (usersEmails: Array<UserProfile | string>) => void;
    isCloud: boolean;
    emailInvitationsEnabled: boolean;
    onUsersInputChange: (usersEmailsSearch: string) => void;
    canInviteGuests: boolean;
    canAddUsers: boolean;
    townSquareDisplayName: string;
    channelToInvite?: Channel;
    onPaste?: (e: ClipboardEvent) => void;
    useGuestMagicLink: boolean;
    toggleGuestMagicLink: () => void;
    lockProfileFieldsForEmailUsers: LockProfileFieldsSetting;
    onProfileChange: (profile: MemberInviteProfile) => void;
};

type InviteViewFooterProps = Pick<Props,
    'currentTeam' |
    'emailInvitationsEnabled' |
    'inviteChannels' |
    'inviteType' |
    'lockProfileFieldsForEmailUsers' |
    'profiles' |
    'usersEmails'
> & {
    invite: () => void;
};

export function InviteViewTitle({currentTeam, inviteType}: Pick<Props, 'currentTeam' | 'inviteType'>) {
    const {formatMessage} = useIntl();
    const inviteTypeText = inviteType === InviteType.MEMBER ? formatMessage({
        id: 'invite_modal.people',
        defaultMessage: 'people',
    }) : formatMessage({
        id: 'invite_modal.guests',
        defaultMessage: 'guests',
    });

    return (
        <FormattedMessage
            id='invite_modal.title'
            defaultMessage={'Invite {inviteType} to {team_name}'}
            values={{
                inviteType: inviteTypeText,
                team_name: currentTeam.display_name,
            }}
        />
    );
}

export function InviteViewFooter(props: InviteViewFooterProps) {
    const {formatMessage} = useIntl();
    const inviteURL = useMemo(() => {
        return `${getSiteURL()}/signup_user_complete/?id=${props.currentTeam.invite_id}`;
    }, [props.currentTeam.invite_id]);
    const copyText = useCopyText({text: inviteURL});
    const showMemberProfileInputs = props.inviteType === InviteType.MEMBER &&
        canPresetMemberInviteProfiles(props.emailInvitationsEnabled, props.lockProfileFieldsForEmailUsers);
    const arePresetProfilesValid = useMemo(() => {
        if (!showMemberProfileInputs) {
            return true;
        }

        return getEmailsToPreset(props.usersEmails).every((email) => {
            const profile = getProfileForEmail(props.profiles, email);
            if (!profile || !profileHasInput(profile)) {
                return true;
            }
            return isValidUsername(profile.username.toLowerCase()) === undefined;
        });
    }, [showMemberProfileInputs, props.usersEmails, props.profiles]);
    const isInviteValid = props.inviteType === InviteType.GUEST ?
        props.inviteChannels.channels.length > 0 && props.usersEmails.length > 0 :
        props.usersEmails.length > 0 && arePresetProfilesValid;

    return (
        <>
            {props.inviteType === InviteType.MEMBER && (
                <Button
                    onClick={copyText.onClick}
                    data-testid='InviteView__copyInviteLink'
                    aria-label={
                        formatMessage({
                            id: 'invite_modal.copy_link.url_aria',
                            defaultMessage: 'team invite link {inviteURL}',
                        }, {inviteURL})
                    }
                    emphasis='secondary'
                    aria-live='polite'
                >
                    {!copyText.copiedRecently && (
                        <>
                            <i className='icon icon-link-variant'/>
                            <FormattedMessage
                                id='invite_modal.copy_link'
                                defaultMessage='Copy invite link'
                            />
                        </>
                    )}
                    {copyText.copiedRecently && (
                        <>
                            <i className='icon icon-check'/>
                            <FormattedMessage
                                id='invite_modal.copied'
                                defaultMessage='Copied'
                            />
                        </>
                    )}
                </Button>
            )}
            <Button
                disabled={!isInviteValid}
                onClick={props.invite}
                emphasis='primary'
                data-testid='inviteButton'
            >
                <FormattedMessage
                    id='invite_modal.invite'
                    defaultMessage='Invite'
                />
            </Button>
        </>
    );
}

export default function InviteView(props: Props) {
    useEffect(() => {
        if (!props.currentTeam.invite_id) {
            props.regenerateTeamInviteId(props.currentTeam.id);
        }
    }, [props.currentTeam.id, props.currentTeam.invite_id, props.regenerateTeamInviteId]);

    const {formatMessage} = useIntl();

    const errorProperties = {
        showError: false,
        errorMessage: messages.exceededMaxBatch,
        errorMessageValues: {
            text: Constants.MAX_ADD_MEMBERS_BATCH.toString(),
        },
    };

    if (props.usersEmails.length > Constants.MAX_ADD_MEMBERS_BATCH) {
        errorProperties.showError = true;
    }

    let placeholder;
    let noMatchMessage;
    if (props.emailInvitationsEnabled) {
        placeholder = formatMessage({
            id: 'invite_modal.add_invites',
            defaultMessage: 'Enter a name or email address',
        });
        noMatchMessage = messages.noUserFound;
    } else {
        placeholder = formatMessage({
            id: 'invitation_modal.members.search-and-add.placeholder-email-disabled',
            defaultMessage: 'Add members',
        });
        noMatchMessage = messages.noUserFoundEmailDisabled;
    }

    let validAddressMessage;
    if (props.inviteType === InviteType.MEMBER) {
        validAddressMessage = messages.validAddressMember;
    } else {
        validAddressMessage = messages.validAddressGuest;
    }

    const showMemberProfileInputs = props.inviteType === InviteType.MEMBER &&
        canPresetMemberInviteProfiles(props.emailInvitationsEnabled, props.lockProfileFieldsForEmailUsers);

    return (
        <>
            <div className='InviteView__sectionTitle InviteView__sectionTitle--first'>
                <FormattedMessage
                    id='invite_modal.to'
                    defaultMessage='To:'
                />
            </div>
            <UsersEmailsInput
                {...errorProperties}
                usersLoader={props.usersLoader}
                placeholder={placeholder}
                ariaLabel={formatMessage({
                    id: 'invitation_modal.members.search_and_add.title',
                    defaultMessage: 'Invite People',
                })}
                onChange={(usersEmails: Array<UserProfile | string>) => {
                    props.onChangeUsersEmails(usersEmails);
                }}
                value={props.usersEmails}
                validAddressMessage={validAddressMessage}
                noMatchMessage={noMatchMessage}
                onInputChange={props.onUsersInputChange}
                inputValue={props.usersEmailsSearch}
                emailInvitationsEnabled={props.emailInvitationsEnabled}
                autoFocus={true}
                onPaste={props.onPaste}
                menuPortal={true}
            />
            {props.canInviteGuests && props.canAddUsers &&
                <InviteAs
                    inviteType={props.inviteType}
                    setInviteAs={props.setInviteAs}
                    titleClass='InviteView__sectionTitle'
                    canInviteGuests={props.canInviteGuests}
                />
            }
            {showMemberProfileInputs && (
                <MemberProfileInputs
                    usersEmails={props.usersEmails}
                    profiles={props.profiles}
                    onProfileChange={props.onProfileChange}
                />
            )}
            {(props.inviteType === InviteType.GUEST || (props.inviteType === InviteType.MEMBER && props.channelToInvite)) && (
                <AddToChannels
                    setCustomMessage={props.setCustomMessage}
                    toggleCustomMessage={props.toggleCustomMessage}
                    customMessage={props.customMessage}
                    onChannelsChange={props.onChannelsChange}
                    onChannelsInputChange={props.onChannelsInputChange}
                    inviteChannels={props.inviteChannels}
                    channelsLoader={props.channelsLoader}
                    currentChannel={props.currentChannel}
                    townSquareDisplayName={props.townSquareDisplayName}
                    titleClass='InviteView__sectionTitle'
                    channelToInvite={props.channelToInvite}
                    inviteType={props.inviteType}
                />
            )}
            {props.inviteType === InviteType.GUEST && props.canInviteGuestsWithMagicLink && (
                <div className='InviteView__guestMagicLinkSection'>
                    <label className='InviteView__guestMagicLinkCheckbox'>
                        <input
                            type='checkbox'
                            checked={props.useGuestMagicLink}
                            onChange={props.toggleGuestMagicLink}
                            data-testid='InviteView__guestMagicLinkCheckbox'
                        />
                        <FormattedMessage
                            id='invite_modal.guest_magic_link'
                            defaultMessage='Allow invited guests to log in with a magic link (without password)'
                        />
                    </label>
                </div>
            )}
            <OverageUsersBannerNotice/>
        </>
    );
}

const messages = defineMessages({
    exceededMaxBatch: {
        id: 'invitation_modal.invite_members.exceeded_max_add_members_batch',
        defaultMessage: 'No more than **{text}** people can be invited at once',
    },
    noUserFound: {
        id: 'invitation_modal.members.users_emails_input.no_user_found_matching',
        defaultMessage: 'No one found matching **{text}**. Enter their email to invite them.',
    },
    noUserFoundEmailDisabled: {
        id: 'invitation_modal.members.users_emails_input.no_user_found_matching-email-disabled',
        defaultMessage: 'No one found matching **{text}**',
    },
    validAddressGuest: {
        id: 'invitation_modal.guests.users_emails_input.valid_email',
        defaultMessage: 'Invite **{email}** as a guest',
    },
    validAddressMember: {
        id: 'invitation_modal.members.users_emails_input.valid_email',
        defaultMessage: 'Invite **{email}** as a team member',
    },
});
