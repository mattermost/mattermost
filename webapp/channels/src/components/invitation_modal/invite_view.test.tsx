// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {SelfHostedProducts} from 'utils/constants';
import {TestHelper as TH} from 'utils/test_helper';
import {generateId} from 'utils/utils';

import {InviteType} from './invite_as';
import InviteView from './invite_view';
import type {Props} from './invite_view';

jest.mock('components/common/hooks/useAccessControlAttributes', () => ({
    __esModule: true,
    EntityType: {Channel: 'channel', Team: 'team'},
    default: jest.fn(() => ({
        attributeTags: ['Engineering'],
        structuredAttributes: [{name: 'Department', values: ['Engineering']}],
        loading: false,
        error: null,
        fetchAttributes: jest.fn(),
    })),
}));

const defaultProps: Props = deepFreeze({
    setInviteAs: jest.fn(),
    inviteType: InviteType.MEMBER,
    titleClass: 'title',

    invite: jest.fn(),
    onChannelsChange: jest.fn(),
    onChannelsInputChange: jest.fn(),
    onClose: jest.fn(),
    currentTeam: {} as Team,
    currentChannel: {
        display_name: 'some_channel',
    },
    setCustomMessage: jest.fn(),
    toggleCustomMessage: jest.fn(),
    channelsLoader: jest.fn(),
    regenerateTeamInviteId: jest.fn(),
    isAdmin: false,
    membershipPolicyEnforced: false,
    usersLoader: jest.fn(),
    onChangeUsersEmails: jest.fn(),
    isCloud: false,
    emailInvitationsEnabled: true,
    onUsersInputChange: jest.fn(),
    headerClass: '',
    footerClass: '',
    canInviteGuests: true,
    canAddUsers: true,

    customMessage: {
        message: '',
        open: false,
    },
    sending: false,
    inviteChannels: {
        channels: [],
        search: '',
    },
    usersEmails: [],
    usersEmailsSearch: '',
    townSquareDisplayName: '',
    canInviteGuestsWithMagicLink: false,
    useGuestMagicLink: false,
    toggleGuestMagicLink: jest.fn(),
    lockProfileFieldsForEmailUsers: 'none',
    profiles: {},
    onProfileChange: jest.fn(),
});

let props = defaultProps;

describe('InviteView', () => {
    const state = {
        entities: {
            admin: {
                prevTrialLicense: {
                    IsLicensed: 'true',
                },
            },
            general: {
                config: {
                    BuildEnterpriseReady: 'true',
                },
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                    Id: generateId(),
                },
            },
            cloud: {
                subscription: {
                    is_free_trial: 'false',
                    trial_end_at: 0,
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_user'},
                },
            },
            roles: {
                roles: {
                    system_user: {
                        permissions: [],
                    },
                },
            },
            preferences: {
                myPreferences: {},
            },
            hostedCustomer: {
                products: {
                    productsLoaded: true,
                    products: {
                        prod_professional: TH.getProductMock({
                            id: 'prod_professional',
                            name: 'Professional',
                            sku: SelfHostedProducts.PROFESSIONAL,
                            price_per_seat: 7.5,
                        }),
                    },
                },
            },
            limits: {
                serverLimits: {},
            },
        },
    };

    beforeEach(() => {
        props = defaultProps;
    });

    function renderControlledInviteView(overrideProps: Partial<Props> = {}) {
        const onChangeUsersEmails = jest.fn();
        const onUsersInputChange = jest.fn();
        const usersLoader = jest.fn().mockImplementation((_search: string, callback: (users: UserProfile[]) => void) => {
            callback([]);
            return Promise.resolve([]);
        });

        const Wrapper = () => {
            const [usersEmails, setUsersEmails] = React.useState<Array<UserProfile | string>>([]);
            const [usersEmailsSearch, setUsersEmailsSearch] = React.useState('');

            return (
                <InviteView
                    {...defaultProps}
                    {...overrideProps}
                    usersLoader={usersLoader}
                    usersEmails={usersEmails}
                    usersEmailsSearch={usersEmailsSearch}
                    onChangeUsersEmails={(nextUsersEmails) => {
                        onChangeUsersEmails(nextUsersEmails);
                        setUsersEmails(nextUsersEmails);
                    }}
                    onUsersInputChange={(nextUsersEmailsSearch) => {
                        onUsersInputChange(nextUsersEmailsSearch);
                        setUsersEmailsSearch(nextUsersEmailsSearch);
                    }}
                />
            );
        };

        return {
            ...renderWithContext(<Wrapper/>, state),
            onChangeUsersEmails,
            onUsersInputChange,
            usersLoader,
        };
    }

    it('shows InviteAs component when user can choose to invite guests or users', async () => {
        renderWithContext(
            <InviteView {...props}/>,
            state,
        );
        expect(screen.getByText('Invite as')).toBeInTheDocument();
    });

    it('hides InviteAs component when user can not choose members option', async () => {
        props = {
            ...defaultProps,
            canAddUsers: false,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        expect(screen.queryByText('Invite as')).not.toBeInTheDocument();
    });

    it('hides InviteAs component when user can not choose guests option', async () => {
        props = {
            ...defaultProps,
            canInviteGuests: false,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );
        expect(screen.queryByText('Invite as')).not.toBeInTheDocument();
    });

    it('shows guest magic link checkbox when inviting guests and guest magic link is enabled', async () => {
        props = {
            ...defaultProps,
            inviteType: InviteType.GUEST,
            canInviteGuestsWithMagicLink: true,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        expect(screen.getByTestId('InviteView__guestMagicLinkCheckbox')).toBeInTheDocument();
    });

    it('hides guest magic link checkbox when inviting members', async () => {
        props = {
            ...defaultProps,
            inviteType: InviteType.MEMBER,
            canInviteGuestsWithMagicLink: true,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        expect(screen.queryByTestId('InviteView__guestMagicLinkCheckbox')).not.toBeInTheDocument();
    });

    it('hides guest magic link checkbox when guest magic link is not enabled', async () => {
        props = {
            ...defaultProps,
            inviteType: InviteType.GUEST,
            canInviteGuestsWithMagicLink: false,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        expect(screen.queryByTestId('InviteView__guestMagicLinkCheckbox')).not.toBeInTheDocument();
    });

    it('calls toggleGuestMagicLink when checkbox is clicked', async () => {
        const toggleGuestMagicLink = jest.fn();
        props = {
            ...defaultProps,
            inviteType: InviteType.GUEST,
            canInviteGuestsWithMagicLink: true,
            toggleGuestMagicLink,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        const checkbox = screen.getByTestId('InviteView__guestMagicLinkCheckbox');
        await userEvent.click(checkbox);

        expect(toggleGuestMagicLink).toHaveBeenCalledTimes(1);
    });

    it('keeps pasted invalid text as draft and leaves invite disabled', async () => {
        const user = userEvent.setup();
        const {onChangeUsersEmails, onUsersInputChange, usersLoader} = renderControlledInviteView();

        const input = screen.getByRole('combobox', {name: 'Invite People'});
        await user.click(input);
        await user.paste('unknownperson');

        await waitFor(() => {
            expect(onUsersInputChange).toHaveBeenCalledWith('unknownperson');
        });

        expect(onChangeUsersEmails).not.toHaveBeenCalledWith([expect.anything()]);
        expect(usersLoader).toHaveBeenCalledWith('unknownperson', expect.any(Function));
        expect(input).toHaveValue('unknownperson');
        expect(screen.getByTestId('inviteButton')).toBeDisabled();
        await waitFor(() => {
            expect(document.querySelector('.users-emails-input__menu-notice')).toHaveTextContent('No one found matching unknownperson. Enter their email to invite them.');
        });
    });

    it('creates a chip for a pasted single valid email and enables invite', async () => {
        const user = userEvent.setup();
        const {onChangeUsersEmails} = renderControlledInviteView();

        const input = screen.getByRole('combobox', {name: 'Invite People'});
        await user.click(input);
        await user.paste('person.one@example.com');

        await waitFor(() => {
            expect(onChangeUsersEmails).toHaveBeenCalledWith(['person.one@example.com']);
        });

        expect(input).toHaveValue('');
        expect(screen.getByTestId('inviteButton')).toBeEnabled();
    });

    it('creates chips for pasted space-separated valid emails and enables invite', async () => {
        const user = userEvent.setup();
        const {onChangeUsersEmails} = renderControlledInviteView();

        const input = screen.getByRole('combobox', {name: 'Invite People'});
        await user.click(input);
        fireEvent.paste(input, {
            clipboardData: {
                getData: (type: string) => {
                    if (type === 'Text') {
                        return 'person.one@example.com person.two@example.com';
                    }
                    return '';
                },
            },
        });

        await waitFor(() => {
            expect(onChangeUsersEmails).toHaveBeenCalledWith(['person.one@example.com', 'person.two@example.com']);
        });

        expect(input).toHaveValue('');
        expect(screen.getByTestId('inviteButton')).toBeEnabled();
    });

    it('does not create a chip prematurely while typing a valid email', async () => {
        const user = userEvent.setup();
        const {onChangeUsersEmails, onUsersInputChange} = renderControlledInviteView();

        const input = screen.getByRole('combobox', {name: 'Invite People'});
        await user.click(input);
        await user.type(input, 'one@example.com');

        expect(onChangeUsersEmails).not.toHaveBeenCalledWith(['one@example.com']);
        expect(onUsersInputChange).toHaveBeenCalledWith('one@example.com');
        expect(input).toHaveValue('one@example.com');
        expect(screen.getByTestId('inviteButton')).toBeDisabled();
    });

    describe('pre-set member profiles', () => {
        it('hides the profile inputs when the lock setting is none', () => {
            renderWithContext(
                <InviteView
                    {...defaultProps}
                    usersEmails={['one@example.com']}
                />,
                state,
            );
            expect(screen.queryByTestId('MemberProfileInputs')).not.toBeInTheDocument();
        });

        it('shows the profile inputs when the lock setting is enabled', () => {
            renderWithContext(
                <InviteView
                    {...defaultProps}
                    lockProfileFieldsForEmailUsers='name_and_username'
                    usersEmails={['one@example.com']}
                />,
                state,
            );
            expect(screen.getByTestId('MemberProfileInputs')).toBeInTheDocument();
        });

        it('hides the profile inputs when inviting guests', () => {
            renderWithContext(
                <InviteView
                    {...defaultProps}
                    lockProfileFieldsForEmailUsers='name_and_username'
                    inviteType={InviteType.GUEST}
                    usersEmails={['one@example.com']}
                />,
                state,
            );
            expect(screen.queryByTestId('MemberProfileInputs')).not.toBeInTheDocument();
        });

        it('hides the profile inputs when email invitations are disabled', () => {
            renderWithContext(
                <InviteView
                    {...defaultProps}
                    lockProfileFieldsForEmailUsers='name_and_username'
                    emailInvitationsEnabled={false}
                    usersEmails={['one@example.com']}
                />,
                state,
            );
            expect(screen.queryByTestId('MemberProfileInputs')).not.toBeInTheDocument();
        });

        it('disables invite when a pre-set profile has an invalid username', () => {
            renderWithContext(
                <InviteView
                    {...defaultProps}
                    lockProfileFieldsForEmailUsers='name_and_username'
                    usersEmails={['one@example.com']}
                    profiles={{
                        'one@example.com': {
                            email: 'one@example.com',
                            username: 'inv@lid',
                            first_name: 'One',
                            last_name: 'Example',
                        },
                    }}
                />,
                state,
            );
            expect(screen.getByTestId('inviteButton')).toBeDisabled();
        });

        it('keeps invite enabled when pre-set profiles are empty or valid', () => {
            renderWithContext(
                <InviteView
                    {...defaultProps}
                    lockProfileFieldsForEmailUsers='name_and_username'
                    usersEmails={['one@example.com', 'two@example.com']}
                    profiles={{
                        'one@example.com': {
                            email: 'one@example.com',
                            username: 'one.example',
                            first_name: 'One',
                            last_name: 'Example',
                        },
                    }}
                />,
                state,
            );
            expect(screen.getByTestId('inviteButton')).toBeEnabled();
        });
    });

    it('shows the membership-policy notice, attribute tags, and invite-link warning on a governed team', () => {
        props = {
            ...defaultProps,
            membershipPolicyEnforced: true,
            currentTeam: {id: 'team1', display_name: 'Team One', invite_id: 'abc'} as Team,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        expect(screen.getByText('Only users who meet the membership requirements can be added to this team.')).toBeInTheDocument();
        expect(screen.getByText('Department: Engineering')).toBeInTheDocument();
        expect(screen.getByText('People who use this link must meet the membership requirements to join.')).toBeInTheDocument();

        // The notice and the link warning are exposed as live status regions.
        expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(2);
    });

    it('does not show the membership-policy notice on a non-governed team', () => {
        props = {
            ...defaultProps,
            membershipPolicyEnforced: false,
            currentTeam: {id: 'team1', display_name: 'Team One', invite_id: 'abc'} as Team,
        };

        renderWithContext(
            <InviteView {...props}/>,
            state,
        );

        expect(screen.queryByText('Only users who meet the membership requirements can be added to this team.')).not.toBeInTheDocument();
        expect(screen.queryByText('People who use this link must meet the membership requirements to join.')).not.toBeInTheDocument();
    });
});
