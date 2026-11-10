// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {setThreadFollow} from 'mattermost-redux/actions/threads';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ThreadPane from './thread_pane';

jest.mock('mattermost-redux/actions/threads', () => ({
    ...jest.requireActual('mattermost-redux/actions/threads'),
    setThreadFollow: jest.fn(() => ({type: 'MOCK_SET_THREAD_FOLLOW'})),
}));

jest.mock('mattermost-redux/actions/properties', () => ({
    ...jest.requireActual('mattermost-redux/actions/properties'),
    fetchPropertyFields: jest.fn(() => () => Promise.resolve({data: []})),
}));

const mockRouting = {
    params: {
        team: 'team',
    },
    currentUserId: 'uid',
    currentTeamId: 'tid',
    goToInChannel: jest.fn(),
    select: jest.fn(),
};
jest.mock('../../hooks', () => {
    return {
        useThreadRouting: () => mockRouting,
    };
});

jest.mock('components/popout_button', () => ({
    __esModule: true,
    default: ({onClick}: {onClick: () => void}) => (
        <button onClick={onClick}>{'Popout'}</button>
    ),
}));

jest.mock('../thread_menu', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
        <div data-testid='thread-menu'>{children}</div>
    ),
}));

const CHANNEL_ID = 'pnzsh7kwt7rmzgj8yb479sc9yw';
const GROUP_ID = 'access_control_group';

function attributeField(name: string, actions: string[]): PropertyField {
    return {
        id: `field_${name}`,
        group_id: GROUP_ID,
        name,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs: {
            actions,
            options: [{id: `opt_${name}`, name: name.toUpperCase(), color: '#1e325c'}],
        },
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function attributeValue(field: PropertyField): PropertyValue<unknown> {
    return {
        id: `value_${field.id}`,
        target_id: CHANNEL_ID,
        target_type: 'channel',
        group_id: GROUP_ID,
        field_id: field.id,
        value: `opt_${field.name}`,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

// Channel attributes need the flag and an Enterprise Advanced license, plus the
// group resolved by name, since fields are stored under the group's UUID.
function withChannelAttributes(state: DeepPartial<GlobalState>, fields: PropertyField[]): DeepPartial<GlobalState> {
    return {
        ...state,
        entities: {
            ...state.entities,
            general: {
                ...state.entities?.general,
                config: {...state.entities?.general?.config, FeatureFlagChannelAttributes: 'true'},
                license: {IsLicensed: 'true', SkuShortName: 'advanced'},
            },
            properties: {
                groups: {
                    byId: {[GROUP_ID]: {id: GROUP_ID, name: 'access_control'}},
                    byName: {access_control: {id: GROUP_ID, name: 'access_control'}},
                },
                fields: {
                    byId: Object.fromEntries(fields.map((field) => [field.id, field])),
                    byObjectType: {channel: {[GROUP_ID]: Object.fromEntries(fields.map((field) => [field.id, field]))}},
                },
                values: {
                    byTargetId: {[CHANNEL_ID]: Object.fromEntries(fields.map((field) => [field.id, attributeValue(field)]))},
                    byFieldId: {},
                },
            },
        },
    };
}

// jsdom does not lay out, so the chip row has no width to measure and would stay
// hidden pending measurement. The row measures the space its siblings leave in the
// header, so the header's left side reports a width and every chip a fixed one.
function stubHeaderWidths(availableWidth: number, chipWidth = 60) {
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
        const isLabels = this.classList.contains('ChannelAttributeLabels');
        const isParentOfLabels = Boolean(this.querySelector?.(':scope > .ChannelAttributeLabels'));
        return {width: isLabels || isParentOfLabels ? availableWidth : chipWidth} as DOMRect;
    });
}

describe('components/threading/global_threads/thread_pane', () => {
    let props: ComponentProps<typeof ThreadPane>;
    let mockThread: typeof props['thread'];
    let initialState: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockThread = {
            id: '1y8hpek81byspd4enyk9mp1ncw',
            unread_replies: 0,
            unread_mentions: 0,
            is_following: true,
            post: {
                user_id: 'mt5td9mdriyapmwuh5pc84dmhr',
                channel_id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
            },
        } as typeof props['thread'];

        props = {
            thread: mockThread,
        };

        const user1 = TestHelper.fakeUserWithId('uid');
        const profiles: Record<string, UserProfile> = {};
        profiles[user1.id] = user1;

        initialState = {
            entities: {
                general: {
                    config: {},
                },
                preferences: {
                    myPreferences: {},
                },
                posts: {
                    postsInThread: {'1y8hpek81byspd4enyk9mp1ncw': []},
                    posts: {
                        '1y8hpek81byspd4enyk9mp1ncw': {
                            id: '1y8hpek81byspd4enyk9mp1ncw',
                            user_id: 'mt5td9mdriyapmwuh5pc84dmhr',
                            channel_id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
                            create_at: 1610486901110,
                            edit_at: 1611786714912,
                        },
                    },
                },
                channels: {
                    channels: {
                        pnzsh7kwt7rmzgj8yb479sc9yw: {
                            id: 'pnzsh7kwt7rmzgj8yb479sc9yw',
                            display_name: 'Team name',
                        },
                    },
                },
                users: {
                    profiles,
                    currentUserId: 'uid',
                },
            },
        };
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ThreadPane {...props}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should support follow', async () => {
        props.thread.is_following = false;
        renderWithContext(
            <ThreadPane {...props}/>,
            initialState,
        );
        await userEvent.click(screen.getByText('Follow'));
        expect(setThreadFollow).toHaveBeenCalledWith(mockRouting.currentUserId, mockRouting.currentTeamId, mockThread.id, true);
    });

    test('should support unfollow', async () => {
        props.thread.is_following = true;
        renderWithContext(
            <ThreadPane {...props}/>,
            initialState,
        );

        await userEvent.click(screen.getByText('Following'));
        expect(setThreadFollow).toHaveBeenCalledWith(mockRouting.currentUserId, mockRouting.currentTeamId, mockThread.id, false);
    });

    test('should support openInChannel', async () => {
        renderWithContext(
            <ThreadPane {...props}/>,
            initialState,
        );

        await userEvent.click(screen.getByText('Team name'));
        expect(mockRouting.goToInChannel).toHaveBeenCalledWith('1y8hpek81byspd4enyk9mp1ncw');
    });

    test('should support go back to list', async () => {
        renderWithContext(
            <ThreadPane {...props}/>,
            initialState,
        );

        const backButton = document.querySelector('.back') as HTMLElement;
        expect(backButton).toBeInTheDocument();
        await userEvent.click(backButton);
        expect(mockRouting.select).toHaveBeenCalledWith();
    });

    describe('channel attribute labels', () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should render the header and info chips beside the channel name', async () => {
            stubHeaderWidths(1000);

            renderWithContext(
                <ThreadPane {...props}/>,
                withChannelAttributes(initialState, [
                    attributeField('program', ['display_label_header']),
                    attributeField('caveat', ['display_label_info']),
                ]),
            );

            // Both slots in one row, as the channel RHS header does, so info and header
            // chips collapse together instead of competing for the space. The row stays
            // hidden until it has measured how many of them fit.
            await waitFor(() => {
                expect(screen.getAllByTestId('attributeChip')).toHaveLength(2);
                expect(screen.getAllByTestId('attributeChip')[0]).toBeVisible();
            });

            const chips = screen.getAllByTestId('attributeChip');
            expect(chips.map((chip) => chip.textContent)).toEqual(['caveat: CAVEAT', 'program: PROGRAM']);

            // Beside the channel name rather than among the thread controls.
            expect(chips[0].closest('.ThreadPane___header .left')).not.toBeNull();
        });

        test('should read as labels, since Channel Info cannot open from the Threads view', async () => {
            stubHeaderWidths(1000);

            renderWithContext(
                <ThreadPane {...props}/>,
                withChannelAttributes(initialState, [
                    attributeField('program', ['display_label_header']),
                ]),
            );

            const chip = await screen.findByTestId('attributeChip');
            expect(chip.closest('button')).toBeNull();
        });

        test('should collapse every chip into +N rather than clip one in the narrow header', async () => {
            // Less room than a single 60px chip needs, which is the case the thread
            // header passes allowEmptyVisible for.
            stubHeaderWidths(150);

            renderWithContext(
                <ThreadPane {...props}/>,
                withChannelAttributes(initialState, [
                    attributeField('program', ['display_label_header']),
                    attributeField('caveat', ['display_label_header']),
                ]),
            );

            const overflow = await screen.findByTestId('channelAttributeLabelsOverflow-info-header');
            expect(overflow).toHaveTextContent('+2');
            expect(screen.queryByTestId('attributeChip')).not.toBeInTheDocument();
        });
    });
});
