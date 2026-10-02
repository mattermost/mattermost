// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen, waitFor, within} from '@testing-library/react';
import React from 'react';

import {ClientError} from '@mattermost/client';
import {ChevronDownCircleOutlineIcon, FormatListBulletedIcon, LinkVariantIcon, MenuVariantIcon, PoundIcon, PowerPlugOutlineIcon, SitemapIcon, SortAscendingIcon, SyncIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';
import type {PropertyFieldOwner} from '@mattermost/types/properties_user';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {
    CLASSIFICATIONS_MARKINGS_ADMIN_URL,
    CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
    CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
} from 'components/admin_console/classification_markings/utils';
import ModalController from 'components/modal_controller';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {WindowSizes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import GlobalAttributesTable, {fieldMatchesSearch, getDisplayName, getSourceIcon, getSourceKind, getTypeIcon, isClassificationMarkingsField} from './global_attributes_table';

const mockHistoryPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: mockHistoryPush,
    }),
}));

// The server keys every field under a real group UUID that differs from the
// group name ('access_control'); fixtures mirror that so the resolve-by-name
// path is exercised, matching the pattern used by the session_attributes tests.
const ACCESS_CONTROL_GROUP_UUID = 'accesscontrolgroupuuid001';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field-1',
        name: 'field_name',
        type: 'text',
        group_id: ACCESS_CONTROL_GROUP_UUID,
        object_type: 'template',
        target_id: '',
        target_type: 'system',
        create_at: 1700000000000,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        attrs: {},
        ...overrides,
    } as PropertyField;
}

function makeClientError(statusCode: number): ClientError {
    return new ClientError('https://example.com', {
        message: 'error',
        status_code: statusCode,
        url: 'https://example.com/api/v4/properties/groups/access_control/template/fields/field-1',
    });
}

function getBaseState(): DeepPartial<GlobalState> {
    return {
        entities: {
            general: {},
            properties: {
                fields: {
                    byId: {},
                    byObjectType: {},
                },
            },
        },
    };
}

type EntitiesPartial = NonNullable<DeepPartial<GlobalState>['entities']>;

// State where the Classification Markings admin page is actually reachable: Enterprise
// Advanced license (matching admin_definition.tsx's minLicenseTier(EnterpriseAdvanced)
// check) and the ClassificationMarkings feature flag on, read from the same entities/admin
// config tree the route rule itself reads. Both conditions default to "reachable" but can
// be independently overridden to exercise the AND logic off the all-true/all-false diagonal
// (e.g. license ok but flag off, or vice versa).
function getReachableState(overrides: {licenseSku?: string; classificationMarkingsFlagOn?: boolean; channelAttributesFlagOn?: boolean} = {}): DeepPartial<GlobalState> {
    const {licenseSku = 'advanced', classificationMarkingsFlagOn = true, channelAttributesFlagOn = true} = overrides;
    const state = getBaseState();
    state.entities!.general = {
        license: {IsLicensed: 'true', SkuShortName: licenseSku},
    } as EntitiesPartial['general'];
    state.entities!.admin = {
        config: {FeatureFlags: {ClassificationMarkings: classificationMarkingsFlagOn, ChannelAttributes: channelAttributesFlagOn}},
    } as EntitiesPartial['admin'];
    return state;
}

// State where the table fetches every resource scope: Enterprise Advanced
// license plus the ChannelAttributes and PostAttributes flags in client config
// (where the flag selectors read them), matching the gate the table applies
// before fetching. Without this those scopes are skipped and the *-channel-* /
// *-post-* mocks below go unconsumed.
function getAllScopesState(): DeepPartial<GlobalState> {
    const state = getBaseState();
    state.entities!.general = {
        config: {FeatureFlagChannelAttributes: 'true', FeatureFlagPostAttributes: 'true'},
        license: {IsLicensed: 'true', SkuShortName: 'advanced'},
    } as EntitiesPartial['general'];
    return state;
}

function getMobileState(): DeepPartial<GlobalState> {
    const state = getReachableState();
    state.views = {browser: {windowSize: WindowSizes.MOBILE_VIEW}} as DeepPartial<GlobalState>['views'];
    return state;
}

function makeClassificationField(overrides: Partial<PropertyField> = {}): PropertyField {
    return makeField({
        name: CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
        object_type: CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
        type: 'rank',
        attrs: {options: [{id: 'o1', name: 'Low', rank: 1}, {id: 'o2', name: 'High', rank: 2}]},
        ...overrides,
    });
}

describe('GlobalAttributesTable', () => {
    const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields');

    beforeEach(() => {
        getPropertyFields.mockReset();
        mockHistoryPush.mockReset();
        jest.spyOn(Client4, 'getPluginStatuses').mockRejectedValue(new Error('network'));
    });

    // Plugin-owned rows fetch plugin statuses after first paint. That update
    // remounts the actions menu if it is already open, so wait it out first.
    async function openActionsMenu(fieldId = 'field-1') {
        const trigger = await screen.findByTestId(`global-attribute-actions-${fieldId}`);
        await waitFor(() => expect(Client4.getPluginStatuses).toHaveBeenCalled());
        await act(async () => {
            await Promise.resolve();
        });
        await userEvent.click(trigger);
        return screen.findAllByRole('menuitem');
    }

    it('shows the loading state before fields resolve', async () => {
        getPropertyFields.mockResolvedValueOnce([]).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
        });
    });

    it('paints template rows before resource-scope fetches settle', async () => {
        let resolveUser: (value: PropertyField[]) => void;
        const userPending = new Promise<PropertyField[]>((resolve) => {
            resolveUser = resolve;
        });

        getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
            if (opts?.cursorId) {
                return Promise.resolve([]);
            }
            if (objectType === 'template') {
                return Promise.resolve([makeField({id: 'template-1', name: 'department', attrs: {display_name: 'Department'}})]);
            }
            if (objectType === 'user') {
                return userPending;
            }
            return Promise.resolve([]);
        });

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByText('Department')).toBeInTheDocument();
        expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
        expect(within(screen.getByTestId('global-attribute-applies-to')).getByTestId('loadingSpinner')).toBeInTheDocument();

        await act(async () => {
            resolveUser!([makeField({
                id: 'user-1',
                object_type: 'user',
                linked_field_id: 'template-1',
            })]);
            await userPending;
        });

        await waitFor(() => {
            expect(screen.getByTestId('global-attribute-applies-to')).toHaveTextContent('Users');
        });
        expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
    });

    it('keeps the loading screen when the template list is empty until resource scopes settle', async () => {
        let resolveUser: (value: PropertyField[]) => void;
        const userPending = new Promise<PropertyField[]>((resolve) => {
            resolveUser = resolve;
        });

        getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
            if (opts?.cursorId) {
                return Promise.resolve([]);
            }
            if (objectType === 'template') {
                return Promise.resolve([]);
            }
            if (objectType === 'user') {
                return userPending;
            }
            return Promise.resolve([]);
        });

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await waitFor(() => {
            expect(getPropertyFields).toHaveBeenCalledWith(
                'access_control',
                'template',
                'system',
                undefined,
                expect.anything(),
            );
        });
        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
        expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();
        expect(screen.queryByText('user_field')).not.toBeInTheDocument();

        await act(async () => {
            resolveUser!([makeField({id: 'u1', name: 'user_field', object_type: 'user'})]);
            await userPending;
        });

        expect(await screen.findByText('user_field')).toBeInTheDocument();
        expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
        expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();
    });

    it('fetches access_control/template fields scoped to the system target type', async () => {
        getPropertyFields.mockResolvedValueOnce([]).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await waitFor(() => {
            expect(getPropertyFields).toHaveBeenCalled();
        });

        expect(getPropertyFields.mock.calls[0].slice(0, 4)).toEqual([
            'access_control',
            'template',
            'system',
            undefined,
        ]);
    });

    it('renders one row per returned field, including fields under a real group UUID', async () => {
        const fields = [
            makeField({id: 'f1', name: 'first_field', attrs: {display_name: 'First Field'}}),
            makeField({id: 'f2', name: 'second_field'}),
        ];
        getPropertyFields.mockResolvedValueOnce(fields).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByText('First Field')).toBeInTheDocument();
        expect(screen.getByText('second_field')).toBeInTheDocument();
    });

    it('falls back to the field name when no display_name is set', async () => {
        getPropertyFields.mockResolvedValueOnce([makeField({name: 'no_display_name', attrs: {}})]).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByText('no_display_name')).toBeInTheDocument();
    });

    it('sorts rows by name rather than relying on server return order', async () => {
        const fields = [
            makeField({id: 'f1', name: 'zeta_field'}),
            makeField({id: 'f2', name: 'alpha_field'}),
        ];
        getPropertyFields.mockResolvedValueOnce(fields).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await screen.findByText('zeta_field');
        const names = screen.getAllByTestId('global-attribute-name').map((cell) => cell.textContent);
        expect(names).toEqual(['alpha_field', 'zeta_field']);
    });

    it('sorts by the same displayed value as the Attribute column, not the internal name, when they diverge', async () => {
        // Internal names sort z-then-a, but display_name sorts a-then-z — proves the
        // table orders by what the user reads (the Attribute column value), not the
        // hidden internal name behind it.
        const fields = [
            makeField({id: 'f1', name: 'zzz_internal_id', attrs: {display_name: 'Aardvark Attribute'}}),
            makeField({id: 'f2', name: 'aaa_internal_id', attrs: {display_name: 'Zebra Attribute'}}),
        ];
        getPropertyFields.mockResolvedValueOnce(fields).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await screen.findByText('Aardvark Attribute');
        const names = screen.getAllByTestId('global-attribute-name').map((cell) => cell.textContent);
        expect(names).toEqual(['Aardvark Attribute', 'Zebra Attribute']);
    });

    describe('Non-template fields', () => {
        // Keyed on the requested object type rather than a call-order queue: the
        // component fetches the template scope first and the resource scopes after
        // it, each paging until it sees an empty page.
        function mockScopedFields(scopes: {template?: PropertyField[]; user?: PropertyField[]; channel?: PropertyField[]; post?: PropertyField[]}) {
            getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                if (opts?.cursorId) {
                    return Promise.resolve([]);
                }
                return Promise.resolve(scopes[objectType as keyof typeof scopes] ?? []);
            });
        }

        it('lists an unlinked field from each resource scope alongside templates', async () => {
            mockScopedFields({
                user: [makeField({id: 'u1', name: 'user_field', object_type: 'user'})],
                channel: [makeField({id: 'c1', name: 'channel_field', object_type: 'channel'})],
                post: [makeField({id: 'p1', name: 'post_field', object_type: 'post'})],
            });

            renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

            await waitFor(() => {
                expect(screen.getByText('user_field')).toBeInTheDocument();
            });
            expect(screen.getByText('channel_field')).toBeInTheDocument();
            expect(screen.getByText('post_field')).toBeInTheDocument();
        });

        it('excludes a non-template field that is linked to a template', async () => {
            mockScopedFields({
                user: [makeField({id: 'u1', name: 'linked_field', object_type: 'user', linked_field_id: 'template-1'})],
            });

            renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

            expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
            expect(screen.queryByText('linked_field')).not.toBeInTheDocument();
        });

        it('sorts templates and non-template fields together by display name, not templates-then-non-templates', async () => {
            mockScopedFields({
                template: [
                    makeField({id: 't1', name: 'charlie_template', attrs: {display_name: 'Charlie'}}),
                    makeField({id: 't2', name: 'echo_template', attrs: {display_name: 'Echo'}}),
                ],
                user: [makeField({id: 'u1', name: 'bravo_user', object_type: 'user', attrs: {display_name: 'Bravo'}})],
                channel: [makeField({id: 'c1', name: 'delta_channel', object_type: 'channel', attrs: {display_name: 'Delta'}})],
            });

            renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

            await screen.findByText('Charlie');
            const names = screen.getAllByTestId('global-attribute-name').map((cell) => cell.textContent);
            expect(names).toEqual(['Bravo', 'Charlie', 'Delta', 'Echo']);
        });

        it('does not show the empty state when only non-template fields exist', async () => {
            mockScopedFields({user: [makeField({id: 'u1', name: 'user_field', object_type: 'user'})]});

            renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

            expect(await screen.findByText('user_field')).toBeInTheDocument();
            expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();
        });

        it('keeps the listing usable when one resource-scope fetch fails, dropping only that scope', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const cachedChannelField = makeField({id: 'c1', name: 'cached_channel_field', object_type: 'channel'});
            getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                if (opts?.cursorId) {
                    return Promise.resolve([]);
                }
                if (objectType === 'channel') {
                    return Promise.reject(new Error('boom'));
                }
                if (objectType === 'user') {
                    return Promise.resolve([makeField({id: 'u1', name: 'user_field', object_type: 'user'})]);
                }
                return Promise.resolve([]);
            });

            const state = getAllScopesState();
            state.entities!.properties = {
                groups: {
                    byId: {[ACCESS_CONTROL_GROUP_UUID]: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                    byName: {access_control: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                },
                fields: {
                    byId: {c1: cachedChannelField},
                    byObjectType: {
                        channel: {[ACCESS_CONTROL_GROUP_UUID]: {c1: cachedChannelField}},
                    },
                },
            };

            renderWithContext(<GlobalAttributesTable/>, state);

            expect(await screen.findByText('user_field')).toBeInTheDocument();
            expect(screen.queryByTestId('global-attributes-error')).not.toBeInTheDocument();

            // A rejected fetch leaves that scope's cached fields in Redux; showing
            // them would be stale.
            expect(screen.queryByText('cached_channel_field')).not.toBeInTheDocument();

            consoleSpy.mockRestore();
        });

        it('skips the channel scope below Enterprise Advanced, so a channel 501 cannot fail the page', async () => {
            // The server 501s a channel-scoped access_control GET below Enterprise
            // Advanced; fetching it here would reject the load and show the error
            // state. getBaseState() has no Advanced license, so the channel scope
            // must be skipped entirely -- the reject below must never be reached.
            getPropertyFields.mockImplementation((_group, objectType) =>
                (objectType === 'channel' ? Promise.reject(new Error('channel 501')) : Promise.resolve([])),
            );

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
            expect(screen.queryByTestId('global-attributes-error')).not.toBeInTheDocument();
            expect(getPropertyFields.mock.calls.every((call) => call[1] !== 'channel')).toBe(true);
        });

        it('hides a cached channel field when channel attributes are disabled', async () => {
            // Channel-header labels (and a prior visit while licensed) can leave a
            // channel field in the store after this page has stopped fetching that
            // scope.
            const cachedChannel = makeField({id: 'c1', name: 'cached_channel_field', object_type: 'channel'});
            const userField = makeField({id: 'u1', name: 'user_field', object_type: 'user'});
            mockScopedFields({user: [userField]});

            const state = getBaseState();
            state.entities!.properties = {
                groups: {
                    byId: {[ACCESS_CONTROL_GROUP_UUID]: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                    byName: {access_control: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                },
                fields: {
                    byId: {c1: cachedChannel},
                    byObjectType: {
                        channel: {[ACCESS_CONTROL_GROUP_UUID]: {c1: cachedChannel}},
                    },
                },
            };

            renderWithContext(<GlobalAttributesTable/>, state);

            expect(await screen.findByText('user_field')).toBeInTheDocument();
            expect(screen.queryByText('cached_channel_field')).not.toBeInTheDocument();
        });

        it('hides a cached post field when the PostAttributes flag is off', async () => {
            // A prior visit while the flag was on can leave a post field in the
            // store after this page has stopped fetching that scope.
            const cachedPost = makeField({id: 'p1', name: 'cached_post_field', object_type: 'post'});
            const userField = makeField({id: 'u1', name: 'user_field', object_type: 'user'});
            mockScopedFields({user: [userField]});

            const state = getBaseState();
            state.entities!.properties = {
                groups: {
                    byId: {[ACCESS_CONTROL_GROUP_UUID]: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                    byName: {access_control: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                },
                fields: {
                    byId: {p1: cachedPost},
                    byObjectType: {
                        post: {[ACCESS_CONTROL_GROUP_UUID]: {p1: cachedPost}},
                    },
                },
            };

            renderWithContext(<GlobalAttributesTable/>, state);

            expect(await screen.findByText('user_field')).toBeInTheDocument();
            expect(screen.queryByText('cached_post_field')).not.toBeInTheDocument();
        });
    });

    it('renders the Applies-to column as an explicit placeholder when nothing is linked', async () => {
        getPropertyFields.mockResolvedValueOnce([makeField()]).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        await waitFor(() => {
            expect(screen.getByTestId('global-attribute-applies-to')).toHaveTextContent('—');
        });
        expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
    });

    it('renders Applies-to chips for the resources a field is linked to', async () => {
        const template = makeField({id: 'template-1', name: 'department'});
        getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
            if (opts?.cursorId) {
                return Promise.resolve([]);
            }
            if (objectType === 'template') {
                return Promise.resolve([template]);
            }
            if (objectType === 'user') {
                return Promise.resolve([makeField({
                    id: 'user-1',
                    object_type: 'user',
                    linked_field_id: template.id,
                })]);
            }
            if (objectType === 'post') {
                return Promise.resolve([makeField({
                    id: 'post-1',
                    object_type: 'post',
                    linked_field_id: template.id,
                })]);
            }
            return Promise.resolve([]);
        });

        renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

        await waitFor(() => {
            expect(screen.getByTestId('global-attribute-applies-to')).toHaveTextContent('Users');
        });
        const appliesTo = screen.getByTestId('global-attribute-applies-to');
        expect(appliesTo).toHaveTextContent('Posts');
        expect(appliesTo).not.toHaveTextContent('Channels');
        expect(appliesTo).not.toHaveTextContent('—');
        expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
    });

    // Channels stays fully enabled so the missing Posts chip is attributable to
    // the PostAttributes gate alone, not to every scope being off.
    it('skips the post scope entirely when the PostAttributes flag is off', async () => {
        const template = makeField({id: 'template-1', name: 'department'});
        getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
            if (opts?.cursorId) {
                return Promise.resolve([]);
            }
            if (objectType === 'template') {
                return Promise.resolve([template]);
            }
            if (objectType === 'user') {
                return Promise.resolve([makeField({id: 'user-1', object_type: 'user', linked_field_id: template.id})]);
            }
            if (objectType === 'channel') {
                return Promise.resolve([makeField({id: 'channel-1', object_type: 'channel', linked_field_id: template.id})]);
            }
            if (objectType === 'post') {
                return Promise.resolve([makeField({id: 'post-1', object_type: 'post', linked_field_id: template.id})]);
            }
            return Promise.resolve([]);
        });

        const state = getAllScopesState();
        state.entities!.general!.config!.FeatureFlagPostAttributes = 'false';

        renderWithContext(<GlobalAttributesTable/>, state);

        const appliesTo = await screen.findByTestId('global-attribute-applies-to');
        expect(appliesTo).toHaveTextContent('Users');
        expect(appliesTo).toHaveTextContent('Channels');
        expect(appliesTo).not.toHaveTextContent('Posts');
        expect(getPropertyFields.mock.calls.every((call) => call[1] !== 'post')).toBe(true);
    });

    it('does not render cached Applies-to chips after a resource fetch fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const template = makeField({id: 'template-1', name: 'department'});
        const cachedUserLink = makeField({
            id: 'user-1',
            object_type: 'user',
            linked_field_id: template.id,
        });
        getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
            if (opts?.cursorId) {
                return Promise.resolve([]);
            }
            if (objectType === 'template') {
                return Promise.resolve([template]);
            }
            if (objectType === 'user') {
                return Promise.reject(new Error('network'));
            }
            return Promise.resolve([]);
        });

        const state = getBaseState();
        state.entities!.properties = {
            fields: {
                byId: {
                    [template.id]: template,
                    [cachedUserLink.id]: cachedUserLink,
                },
                byObjectType: {
                    template: {[ACCESS_CONTROL_GROUP_UUID]: {[template.id]: template}},
                    user: {[ACCESS_CONTROL_GROUP_UUID]: {[cachedUserLink.id]: cachedUserLink}},
                },
            },
            groups: {
                byId: {[ACCESS_CONTROL_GROUP_UUID]: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                byName: {access_control: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
            },
        };

        renderWithContext(<GlobalAttributesTable/>, state);

        await waitFor(() => {
            expect(screen.getByTestId('global-attribute-applies-to')).toHaveTextContent('—');
        });
        expect(screen.getByTestId('global-attribute-applies-to')).not.toHaveTextContent('Users');
        expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('still renders Applies-to chips for scopes that loaded after another resource fetch fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const template = makeField({id: 'template-1', name: 'department'});
        const cachedChannelLink = makeField({
            id: 'channel-1',
            object_type: 'channel',
            linked_field_id: template.id,
        });
        getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
            if (opts?.cursorId) {
                return Promise.resolve([]);
            }
            if (objectType === 'template') {
                return Promise.resolve([template]);
            }
            if (objectType === 'user') {
                return Promise.resolve([makeField({
                    id: 'user-1',
                    object_type: 'user',
                    linked_field_id: template.id,
                })]);
            }
            if (objectType === 'channel') {
                return Promise.reject(new Error('network'));
            }
            return Promise.resolve([]);
        });

        const state = getBaseState();
        state.entities!.properties = {
            fields: {
                byId: {
                    [template.id]: template,
                    [cachedChannelLink.id]: cachedChannelLink,
                },
                byObjectType: {
                    template: {[ACCESS_CONTROL_GROUP_UUID]: {[template.id]: template}},
                    channel: {[ACCESS_CONTROL_GROUP_UUID]: {[cachedChannelLink.id]: cachedChannelLink}},
                },
            },
            groups: {
                byId: {[ACCESS_CONTROL_GROUP_UUID]: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                byName: {access_control: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
            },
        };

        renderWithContext(<GlobalAttributesTable/>, state);

        await waitFor(() => {
            expect(screen.getByTestId('global-attribute-applies-to')).toHaveTextContent('Users');
        });
        const appliesTo = screen.getByTestId('global-attribute-applies-to');
        expect(appliesTo).not.toHaveTextContent('Channels');
        expect(appliesTo).not.toHaveTextContent('—');
        expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('renders an ordinary row\'s name without a classification subtitle', async () => {
        getPropertyFields.mockResolvedValueOnce([makeField()]).mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        const nameCell = await screen.findByTestId('global-attribute-name');
        expect(nameCell).toHaveClass('GlobalAttributesTable__name');
        expect(screen.queryByText('Definition is read-only')).not.toBeInTheDocument();
    });

    it('shows the empty-state message when there are no fields', async () => {
        getPropertyFields.mockResolvedValue([]);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
    });

    it('filters rows by the search query and shows a no-match state when nothing remains', async () => {
        const fields = [
            makeField({id: 'f1', name: 'clearance', attrs: {display_name: 'Clearance'}}),
            makeField({id: 'f2', name: 'department', type: 'text', attrs: {display_name: 'Department'}}),
        ];
        getPropertyFields.mockResolvedValueOnce(fields).mockResolvedValue([]);

        const {rerender} = renderWithContext(<GlobalAttributesTable searchQuery='clear'/>, getBaseState());

        expect(await screen.findByText('Clearance')).toBeInTheDocument();
        expect(screen.queryByText('Department')).not.toBeInTheDocument();

        rerender(<GlobalAttributesTable searchQuery='zzz'/>);

        expect(await screen.findByTestId('global-attributes-empty-search')).toBeInTheDocument();
        expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();
    });

    describe('fieldMatchesSearch', () => {
        it('matches display name, internal name, or type label, and ignores blank queries', () => {
            const field = makeField({name: 'dept_code', type: 'select', attrs: {display_name: 'Department'}});

            expect(fieldMatchesSearch(field, '', 'Select')).toBe(true);
            expect(fieldMatchesSearch(field, '  ', 'Select')).toBe(true);
            expect(fieldMatchesSearch(field, 'depart', 'Select')).toBe(true);
            expect(fieldMatchesSearch(field, 'DEPT_CODE', 'Select')).toBe(true);
            expect(fieldMatchesSearch(field, 'select', 'Select')).toBe(true);
            expect(fieldMatchesSearch(field, 'rank', 'Select')).toBe(false);
        });
    });

    describe('Row click', () => {
        it('opens the edit page when a managed row is clicked', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await userEvent.click(await screen.findByTestId('global-attribute-name'));

            expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details/field-1');
        });

        it('does not navigate when the actions menu is opened', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await userEvent.click(await screen.findByTestId('global-attribute-actions-field-1'));

            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        it('opens the classification edit page when a classification row is clicked', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            await userEvent.click(await screen.findByTestId('global-attribute-name'));

            expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/classification');
        });

        it('opens Classification Markings when a classification row is clicked but its edit page is hidden', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState({channelAttributesFlagOn: false}));

            await userEvent.click(await screen.findByTestId('global-attribute-name'));

            expect(mockHistoryPush).toHaveBeenCalledWith(CLASSIFICATIONS_MARKINGS_ADMIN_URL);
        });
    });

    it('shows an error state (not the empty state) when the fetch fails', async () => {
        // Suppress the expected console.error from the load failure this test triggers.
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        getPropertyFields.mockRejectedValue(new Error('boom'));

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByTestId('global-attributes-error')).toBeInTheDocument();
        expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('shows an error state (not the empty state) on a 404, rather than treating it as an empty result', async () => {
        // Suppress the expected console.error from the load failure this test triggers.
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const notFound = Object.assign(new Error('not found'), {status_code: 404});
        getPropertyFields.mockRejectedValue(notFound);

        renderWithContext(<GlobalAttributesTable/>, getBaseState());

        expect(await screen.findByTestId('global-attributes-error')).toBeInTheDocument();
        expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    describe('Type column', () => {
        it.each([
            ['text', 'Text'],
            ['select', 'Select'],
            ['multiselect', 'Multiselect'],
            ['rank', 'Ranked'],
            ['graph', 'Hierarchical'],
        ])('renders the %s type with the %s label and a leading icon', async (type, label) => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: type as PropertyField['type']})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-type');
            expect(cell).toHaveTextContent(label);
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it.each([
            ['phone', 'Phone'],
            ['url', 'URL'],
            ['email', 'Email'],
        ])('renders a text field with value_type %s as %s', async (valueType, label) => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'text', attrs: {value_type: valueType}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-type');
            expect(cell).toHaveTextContent(label);
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('renders a defined fallback (not a blank cell) for a FieldType outside text/select/multiselect/rank/graph', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'date'})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-type');
            expect(cell).toHaveTextContent('Other');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        // Pins the exact icon set to the one used by the User Attributes page's
        // type selector (user_properties_type_menu.tsx) — verified against the
        // Figma design (node 6207:13241), which confirmed the "Ranked" glyph is
        // literally the sort-ascending icon, not an approximation.
        it.each([
            ['text', MenuVariantIcon],
            ['select', ChevronDownCircleOutlineIcon],
            ['multiselect', FormatListBulletedIcon],
            ['rank', SortAscendingIcon],
            ['graph', SitemapIcon],
            ['phone', PoundIcon],
            ['url', LinkVariantIcon],
            ['date', MenuVariantIcon],
        ])('maps the %s field type to the expected icon component', (type, icon) => {
            expect(getTypeIcon(type as PropertyField['type'])).toBe(icon);
        });
    });

    describe('Options column', () => {
        it('renders "Free Text" for a text field', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'text'})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('Free Text');
        });

        it('renders the option count for a select field', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                type: 'select',
                attrs: {options: [{id: 'o1', name: 'A'}, {id: 'o2', name: 'B'}, {id: 'o3', name: 'C'}]},
            })]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('3 options');
        });

        it('renders an explicit zero-count rather than a blank cell', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'multiselect', attrs: {options: []}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('0 options');
        });

        it('uses the singular "1 option" at the pluralization boundary, not "1 options"', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                type: 'select',
                attrs: {options: [{id: 'o1', name: 'A'}]},
            })]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('1 option');
            expect(screen.queryByText('1 options')).not.toBeInTheDocument();
        });

        it('renders the option count for a graph field, not Free Text', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                type: 'graph',
                attrs: {
                    options: [
                        {id: 'o1', name: 'Root', parents: []},
                        {id: 'o2', name: 'Child', parents: ['Root']},
                    ],
                },
            })]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-options');
            expect(cell).toHaveTextContent('2 options');
            expect(cell).not.toHaveTextContent('Free Text');
        });

        it('renders an explicit zero-count for a graph field with no inline options, not Free Text', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                type: 'graph',
                attrs: {options: []},
            })]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-options');
            expect(cell).toHaveTextContent('0 options');
            expect(cell).not.toHaveTextContent('Free Text');
        });

        it('uses options_count when options_omitted is set, never 0 options or Free Text', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                type: 'graph',
                attrs: {
                    options: [],
                    options_omitted: true,
                    options_count: 1500,
                },
            })]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-options');

            // ICU formats 1500 as 1,500; exact text so "0 options" is not a substring false-positive.
            expect(cell.textContent).toBe('1,500 options');
            expect(cell).not.toHaveTextContent('Free Text');
        });

        it('uses options_count when options_omitted and the options key is absent', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                type: 'graph',
                attrs: {
                    options_omitted: true,
                    options_count: 1500,
                },
            })]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-options');
            expect(cell.textContent).toBe('1,500 options');
            expect(cell).not.toHaveTextContent('Free Text');
        });

        it('renders a zero count for a graph field with no options loaded', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'graph', attrs: {}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            expect(await screen.findByTestId('global-attribute-options')).toHaveTextContent('0 options');
        });
    });

    describe('Source column', () => {
        it('resolves the plugin display name when source_plugin_id + protected are set', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                attrs: {source_plugin_id: 'com.example.plugin', protected: true},
            })]).mockResolvedValue([]);

            const state = getBaseState();
            state.plugins = {
                plugins: {
                    'com.example.plugin': {id: 'com.example.plugin', name: 'Example Plugin', version: '1.0.0', webapp: {bundle_path: ''}},
                },
            } as DeepPartial<GlobalState>['plugins'];

            renderWithContext(<GlobalAttributesTable/>, state);

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('Example Plugin');

            // PowerPlugOutlineIcon's path contains newlines; jest-dom's
            // toBeInTheDocument() does not treat that SVG node as in-document.
            expect(cell.firstElementChild?.nodeName.toLowerCase()).toBe('svg');
        });

        it('resolves a server-only plugin name from the admin plugin statuses rather than showing the raw plugin ID', async () => {
            const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses').mockResolvedValue([{
                plugin_id: 'com.mattermost.gahelper',
                name: 'Global Attributes Helper',
                description: '',
                version: '1.0.0',
                cluster_id: '',
                plugin_path: '',
                state: 1,
            }]);

            // No entry in state.plugins: a server-only plugin ships no webapp bundle,
            // so it never registers a client manifest.
            getPropertyFields.mockResolvedValueOnce([makeField({
                attrs: {source_plugin_id: 'com.mattermost.gahelper', protected: true},
            })]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await waitFor(() => {
                expect(getPluginStatuses).toHaveBeenCalled();
            });

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('Global Attributes Helper');
            expect(cell).not.toHaveTextContent('com.mattermost.gahelper');

            getPluginStatuses.mockRestore();
        });

        it('does not fetch plugin statuses when no row is plugin-owned', async () => {
            const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses').mockResolvedValue([]);

            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {ldap: 'someAttribute'}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await screen.findByTestId('global-attribute-source');

            expect(getPluginStatuses).not.toHaveBeenCalled();

            getPluginStatuses.mockRestore();
        });

        describe('owned attributes', () => {
            const mockTemplateWithUserField = (userFieldAttrs?: PropertyField['attrs']) => {
                const template = makeField({id: 'template-1', name: 'department'});
                getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                    if (opts?.cursorId) {
                        return Promise.resolve([]);
                    }
                    if (objectType === 'template') {
                        return Promise.resolve([template]);
                    }
                    if (objectType === 'user') {
                        return Promise.resolve([makeField({
                            id: 'user-1',
                            object_type: 'user',
                            linked_field_id: template.id,
                            attrs: userFieldAttrs,
                        })]);
                    }
                    return Promise.resolve([]);
                });
            };

            it('names a plugin owner from the admin plugin statuses on a template row', async () => {
                const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses').mockResolvedValue([{
                    plugin_id: 'com.mattermost.scim',
                    name: 'SCIM',
                    description: '',
                    version: '1.0.0',
                    cluster_id: '',
                    plugin_path: '',
                    state: 1,
                }]);
                mockTemplateWithUserField({owners: [{id: 'com.mattermost.scim', type: 'plugin', scopes: []}]});

                renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

                await waitFor(() => {
                    expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by SCIM');
                });
                expect(screen.getByTestId('global-attribute-source').querySelector('svg')).toBeInTheDocument();

                getPluginStatuses.mockRestore();
            });

            it('names the owners of a standalone user attribute', async () => {
                getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                    if (opts?.cursorId || objectType !== 'user') {
                        return Promise.resolve([]);
                    }
                    return Promise.resolve([makeField({
                        id: 'user-1',
                        name: 'standalone',
                        object_type: 'user',
                        attrs: {owners: [{id: 'svc-sync', type: 'service', scopes: []}]},
                    })]);
                });

                renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

                await waitFor(() => {
                    expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by svc-sync');
                });
            });

            it('shows the owner alongside an LDAP/SAML link on a standalone user attribute, without scopes', async () => {
                getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                    if (opts?.cursorId || objectType !== 'user') {
                        return Promise.resolve([]);
                    }
                    return Promise.resolve([makeField({
                        id: 'user-1',
                        name: 'standalone',
                        object_type: 'user',
                        attrs: {saml: 'dept', owners: [{id: 'svc-sync', type: 'service', scopes: ['local']}]},
                    })]);
                });

                renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

                await waitFor(() => {
                    expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by svc-sync');
                });
                expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('SAML');
                expect(screen.getByTestId('global-attribute-source')).not.toHaveTextContent('local');
            });

            it('lists every owner in stored order', async () => {
                mockTemplateWithUserField({owners: [
                    {id: 'svc-b', type: 'service', scopes: []},
                    {id: 'svc-a', type: 'service', scopes: []},
                ]});

                renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

                await waitFor(() => {
                    expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by svc-b and svc-a');
                });
            });

            it('still reads "Managed here" when the linked user field has no owners', async () => {
                mockTemplateWithUserField({owners: []});

                renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

                await waitFor(() => {
                    expect(screen.getByTestId('global-attribute-applies-to')).toHaveTextContent('Users');
                });
                expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed here');
            });
        });

        it('shows AD/LDAP when attrs.ldap is set', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {ldap: 'someAttribute'}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('AD/LDAP');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('shows SAML when attrs.saml is set', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {saml: 'someAttribute'}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('SAML');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('shows "AD/LDAP, SAML" when both attrs.ldap and attrs.saml are set', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {ldap: 'employeeID', saml: 'position'}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('AD/LDAP, SAML');
            expect(cell.querySelector('svg')).toBeInTheDocument();
        });

        it('falls back to "Managed here" (no icon) when no source signal is present', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({attrs: {}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const cell = await screen.findByTestId('global-attribute-source');
            expect(cell).toHaveTextContent('Managed here');
            expect(cell.querySelector('svg')).not.toBeInTheDocument();
        });

        it.each([
            ['plugin', PowerPlugOutlineIcon],
            ['ldap_and_saml', SyncIcon],
            ['ldap', SyncIcon],
            ['saml', SyncIcon],
        ])('maps the %s source kind to the expected icon component', (kind, icon) => {
            expect(getSourceIcon(kind as ReturnType<typeof getSourceKind>)).toBe(icon);
        });

        it('maps the managed source kind to no icon', () => {
            expect(getSourceIcon('managed')).toBeUndefined();
        });
    });

    describe('Actions column', () => {
        it('opens the menu with Edit and Delete enabled for a managed field', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            expect(trigger).not.toBeDisabled();

            // * Icon-only trigger has an accessible name for screen readers (WCAG 4.1.2)
            expect(trigger).toHaveAccessibleName('More actions');

            await userEvent.click(trigger);

            const menuitems = screen.getAllByRole('menuitem');
            const edit = menuitems.find((el) => el.textContent?.includes('Edit attribute'));
            const del = menuitems.find((el) => el.textContent?.includes('Delete attribute'));

            expect(edit).toBeDefined();
            expect(del).toBeDefined();
            expect(menuitems.find((el) => el.textContent?.includes('Duplicate attribute'))).toBeUndefined();

            expect(edit!).not.toHaveAttribute('aria-disabled', 'true');
            expect(del!).not.toHaveAttribute('aria-disabled', 'true');

            await userEvent.click(edit!);
            await waitFor(() => {
                expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details/field-1');
            });
        });

        it('enables View (not Edit) and navigates to the edit page for a plugin-owned row (the edit page itself now handles the read-only rendering)', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                attrs: {source_plugin_id: 'com.example.plugin', protected: true},
            })]).mockResolvedValue([]);

            const state = getBaseState();
            state.entities!.admin = {
                pluginStatuses: {'com.example.plugin': {id: 'com.example.plugin'}},
            } as EntitiesPartial['admin'];

            renderWithContext(<GlobalAttributesTable/>, state);

            const menuitems = await openActionsMenu();
            expect(menuitems.find((el) => el.textContent?.includes('Edit attribute'))).toBeUndefined();

            const view = menuitems.find((el) => el.textContent?.includes('View attribute'));
            expect(view).not.toHaveAttribute('aria-disabled', 'true');

            await userEvent.click(view!);
            await waitFor(() => {
                expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details/field-1');
            });
        });

        it('leaves Delete\'s orphan-aware gating unaffected on a plugin-owned row', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({
                attrs: {source_plugin_id: 'com.example.plugin', protected: true},
            })]).mockResolvedValue([]);

            const state = getBaseState();
            state.entities!.admin = {
                pluginStatuses: {'com.example.plugin': {id: 'com.example.plugin'}},
            } as EntitiesPartial['admin'];

            renderWithContext(<GlobalAttributesTable/>, state);

            const menuitems = await openActionsMenu();
            const del = menuitems.find((el) => el.textContent?.includes('Delete attribute'));

            expect(menuitems.find((el) => el.textContent?.includes('Duplicate attribute'))).toBeUndefined();

            // Plugin is installed (pluginStatuses has an entry) -- Delete stays
            // plugin-managed/disabled, same as before this change.
            expect(del).toHaveAttribute('aria-disabled', 'true');
            expect(del).toHaveTextContent('Plugin-managed');
        });

        it('opens Edit for a graph field, same as any other managed type', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'graph'})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            await userEvent.click(trigger);

            const edit = screen.getAllByRole('menuitem').find((el) => el.textContent?.includes('Edit attribute'));
            expect(edit).toBeDefined();
            expect(edit!).not.toHaveAttribute('aria-disabled', 'true');
            expect(edit!).not.toHaveTextContent('Coming soon');
        });

        it('offers View and disables Delete when the listing page is read-only', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable disabled={true}/>, getBaseState());

            // Managed rows never fetch plugin statuses, so open the menu directly
            // rather than via openActionsMenu (which waits on that fetch).
            await userEvent.click(await screen.findByTestId('global-attribute-actions-field-1'));
            const menuitems = screen.getAllByRole('menuitem');
            expect(menuitems.find((el) => el.textContent?.includes('Edit attribute'))).toBeUndefined();

            const view = menuitems.find((el) => el.textContent?.includes('View attribute'));
            expect(view).not.toHaveAttribute('aria-disabled', 'true');

            const del = menuitems.find((el) => el.textContent?.includes('Delete attribute'));
            expect(del).toHaveAttribute('aria-disabled', 'true');

            await userEvent.click(view!);
            await waitFor(() => {
                expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details/field-1');
            });
        });
    });

    describe('Delete action', () => {
        const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');

        beforeEach(() => {
            deletePropertyField.mockReset();
        });

        // The class here is not decoration: the System Console scrolls in
        // .admin-console__wrapper, and that is the ancestor the table pulls back to
        // the top when a delete fails. jsdom implements no scrolling at all, so the
        // method is stubbed to record the call.
        function renderTable(fields: PropertyField[], state: DeepPartial<GlobalState> = getBaseState()) {
            getPropertyFields.mockResolvedValueOnce(fields).mockResolvedValue([]);

            renderWithContext(
                <div className='admin-console__wrapper'>
                    <GlobalAttributesTable/>
                    <ModalController/>
                </div>,
                state,
            );

            const scrollTo = jest.fn();
            Object.assign(document.querySelector('.admin-console__wrapper')!, {scrollTo});

            return {scrollTo};
        }

        // A plugin-owned row is server-protected only while its plugin is still
        // installed, so these tests have to state which plugins the admin console
        // believes are installed. Without this the row reads as orphaned.
        function getStateWithInstalledPlugin(pluginId: string): DeepPartial<GlobalState> {
            const state = getBaseState();
            state.entities!.admin = {
                pluginStatuses: {[pluginId]: {id: pluginId}},
            } as EntitiesPartial['admin'];
            return state;
        }

        const PLUGIN_ID = 'com.acme.plugin';

        function makePluginOwnedField() {
            return makeField({attrs: {display_name: 'Department', source_plugin_id: PLUGIN_ID, protected: true}});
        }

        async function openDeleteModal(fieldId = 'field-1') {
            await userEvent.click(await screen.findByTestId(`global-attribute-actions-${fieldId}`));

            const del = screen.getAllByRole('menuitem').find((el) => el.textContent?.includes('Delete attribute'));
            await userEvent.click(del!);
        }

        it('names the attribute in the confirmation modal instead of deleting straight from the menu', async () => {
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();

            expect(await screen.findByRole('heading', {name: /delete department attribute/i})).toBeInTheDocument();

            // * Opening the modal alone must not have fired the destructive call
            expect(deletePropertyField).not.toHaveBeenCalled();
        });

        it('leaves the row and the API untouched when the modal is cancelled', async () => {
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /cancel/i}));

            expect(deletePropertyField).not.toHaveBeenCalled();
            expect(screen.getByTestId('global-attribute-name')).toHaveTextContent('Department');
        });

        it('deletes a non-template field via its own object type scope', async () => {
            deletePropertyField.mockResolvedValue({status: 'OK'});

            const channelField = makeField({id: 'c1', name: 'channel_field', object_type: 'channel', attrs: {display_name: 'Channel Field'}});

            getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                if (opts?.cursorId) {
                    return Promise.resolve([]);
                }
                return Promise.resolve(objectType === 'channel' ? [channelField] : []);
            });

            renderWithContext(
                <div className='admin-console__wrapper'>
                    <GlobalAttributesTable/>
                    <ModalController/>
                </div>,
                getAllScopesState(),
            );

            await openDeleteModal('c1');
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'channel', 'c1');
            });
        });

        it('deletes via the access_control/template scope and drops the row on success', async () => {
            deletePropertyField.mockResolvedValue({status: 'OK'});
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'field-1');
            });

            // * The row is gone because the reducer removed the field, not because the
            // component hid it locally — the last-attribute empty state proves the store changed
            expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
        });

        it('surfaces a generic banner above the table and keeps the row when the delete fails', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(500));
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            const banner = await screen.findByTestId('global-attributes-delete-error');
            expect(banner).toHaveTextContent('An error occurred while deleting this attribute. Please try again.');

            // * The row survives a failed delete
            expect(screen.getByTestId('global-attribute-name')).toHaveTextContent('Department');
        });

        it('explains the blocking dependency rather than showing the generic error on a 409', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(409));
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            const banner = await screen.findByTestId('global-attributes-delete-error');
            expect(banner).toHaveTextContent(/other attributes are still linked to it/i);
            expect(banner).not.toHaveTextContent('An error occurred while deleting this attribute');
        });

        it('dismisses the error banner without re-running the delete', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(500));
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            const banner = await screen.findByTestId('global-attributes-delete-error');

            // The modal aria-hides the page behind it, so wait for it to tear down before
            // reaching for the banner's own dismiss control by role
            await waitFor(() => {
                expect(screen.queryByText(/permanently remove its definition/i)).not.toBeInTheDocument();
            });

            await userEvent.click(within(banner).getByRole('button', {name: /close/i}));

            expect(screen.queryByTestId('global-attributes-delete-error')).not.toBeInTheDocument();
            expect(deletePropertyField).toHaveBeenCalledTimes(1);
        });

        it('keeps the error live region mounted so the banner is announced when it appears', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(500));
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            // * The region exists before any error, so the banner arriving is a content
            // change inside a live region rather than a newly-inserted region — the
            // latter is not reliably announced
            const liveRegion = await screen.findByRole('alert');
            expect(liveRegion).toBeEmptyDOMElement();

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            // * The node captured before the error now carries the message. A region
            // remounted alongside its content would have left this reference detached
            // and empty, so this also proves the region persisted.
            await waitFor(() => {
                expect(liveRegion).toHaveTextContent('An error occurred while deleting this attribute');
            });
            expect(liveRegion).toBeInTheDocument();
        });

        it('scrolls the page back to the top and takes focus once a failed delete has closed the modal', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(500));
            const {scrollTo} = renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            const liveRegion = await screen.findByRole('alert');

            await waitFor(() => {
                expect(scrollTo).toHaveBeenCalledWith({top: 0});
            });

            // * Focus lands on the banner rather than being restored to the row's
            // actions button, which is what would otherwise scroll the page away
            // from the error again
            expect(liveRegion).toHaveFocus();
        });

        it('still scrolls to the error when the delete outlasts the modal close animation', async () => {
            // GenericModal starts closing before it calls handleConfirm, so a slow
            // request can land after the modal is already gone — the reverse of the
            // usual order, and the case a plain onExited hook would miss
            let failDelete: (error: unknown) => void = () => {};
            deletePropertyField.mockImplementation(() => new Promise((_resolve, reject) => {
                failDelete = reject;
            }));

            const {scrollTo} = renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(screen.queryByText(/permanently remove its definition/i)).not.toBeInTheDocument();
            });
            expect(scrollTo).not.toHaveBeenCalled();

            await act(async () => {
                failDelete(makeClientError(500));
            });

            await waitFor(() => {
                expect(scrollTo).toHaveBeenCalledWith({top: 0});
            });
        });

        it('leaves the scroll position alone when the delete succeeds', async () => {
            deletePropertyField.mockResolvedValue({status: 'OK'});
            const {scrollTo} = renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
            expect(scrollTo).not.toHaveBeenCalled();
        });

        it('leaves the scroll position alone when the modal is cancelled', async () => {
            const {scrollTo} = renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /cancel/i}));

            await waitFor(() => {
                expect(screen.queryByText(/permanently remove its definition/i)).not.toBeInTheDocument();
            });
            expect(scrollTo).not.toHaveBeenCalled();
        });

        it('keeps scrolling to the error on a second failed delete', async () => {
            deletePropertyField.mockRejectedValue(makeClientError(500));
            const {scrollTo} = renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));
            await waitFor(() => {
                expect(scrollTo).toHaveBeenCalledTimes(1);
            });

            await openDeleteModal();
            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            // * The behaviour is per-attempt rather than one-shot. Note this does not
            // pin down *when* the second scroll fires: jsdom completes the modal's
            // fade before the rejection lands, so the ordering the component re-arms
            // for is not reproducible here.
            await waitFor(() => {
                expect(scrollTo).toHaveBeenCalledTimes(2);
            });
        });

        it('keeps Delete disabled with a reason on a plugin-owned row while the plugin is installed', async () => {
            renderTable([makePluginOwnedField()], getStateWithInstalledPlugin(PLUGIN_ID));

            const del = (await openActionsMenu()).find((el) => el.textContent?.includes('Delete attribute'));
            expect(del!).toHaveAttribute('aria-disabled', 'true');
            expect(del!).toHaveTextContent('Plugin-managed');

            // pointerEventsCheck: 0 forces the click past the disabled item's
            // `pointer-events: none`, proving no handler is wired underneath the styling
            await userEvent.click(del!, {pointerEventsCheck: 0});

            // * No modal, no API call — the disabled item is inert, not just styled as disabled
            expect(screen.queryByRole('heading', {name: /delete department attribute/i})).not.toBeInTheDocument();
            expect(deletePropertyField).not.toHaveBeenCalled();
        });

        it('re-enables Delete on a plugin-owned row once the plugin is uninstalled, so the leftover can be cleaned up', async () => {
            deletePropertyField.mockResolvedValue({status: 'OK'});

            // No plugin statuses at all: the source plugin is gone, which is what the
            // server itself keys the delete allowance off (checkFieldDeleteAccess)
            renderTable([makePluginOwnedField()]);

            const del = (await openActionsMenu()).find((el) => el.textContent?.includes('Delete attribute'));
            expect(del!).not.toHaveAttribute('aria-disabled', 'true');
            expect(del!).not.toHaveTextContent('Plugin-managed');

            await userEvent.click(del!);

            // * The confirmation names the plugin the leftover came from, since an
            // uninstalled plugin is otherwise invisible to the admin
            expect(await screen.findByRole('heading', {name: /delete department attribute/i})).toBeInTheDocument();
            expect(screen.getByText(/was created by the plugin "com\.acme\.plugin", which is no longer installed/i)).toBeInTheDocument();

            await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));

            await waitFor(() => {
                expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'field-1');
            });
        });

        it('treats a plugin-owned row as protected while the plugin inventory is still in flight', async () => {
            // An inventory that has not arrived looks byte-for-byte like a server with
            // the plugin uninstalled, so only the settled fetch tells the two apart.
            // This one never settles, pinning the row in the not-yet-known state; the
            // 're-enables Delete' test above covers the settled side.
            const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses').
                mockImplementation(() => new Promise(() => {}));

            renderTable([makePluginOwnedField()]);

            await userEvent.click(await screen.findByTestId('global-attribute-actions-field-1'));

            const del = (await screen.findAllByRole('menuitem')).find((el) => el.textContent?.includes('Delete attribute'));

            // * Without the gate the empty inventory reads as "plugin gone", offering
            // Delete behind a dialog that wrongly says the plugin was uninstalled
            expect(del!).toHaveAttribute('aria-disabled', 'true');
            expect(del!).toHaveTextContent('Plugin-managed');

            getPluginStatuses.mockRestore();
        });

        describe('owned attributes', () => {
            const owner = (id: string, type: PropertyFieldOwner['type'] = 'plugin'): PropertyFieldOwner => ({id, type, scopes: []});

            function mockOwnedTemplate(owners: PropertyFieldOwner[]) {
                const template = makeField({id: 'template-1', name: 'department'});
                getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                    if (opts?.cursorId) {
                        return Promise.resolve([]);
                    }
                    if (objectType === 'template') {
                        return Promise.resolve([template]);
                    }
                    if (objectType === 'user') {
                        return Promise.resolve([makeField({id: 'user-1', object_type: 'user', linked_field_id: template.id, attrs: {owners}})]);
                    }
                    return Promise.resolve([]);
                });
            }

            function renderOwned(installedPluginId?: string) {
                const state = getAllScopesState();
                if (installedPluginId) {
                    state.entities!.admin = {pluginStatuses: {[installedPluginId]: {id: installedPluginId}}} as EntitiesPartial['admin'];
                }
                renderWithContext(
                    <>
                        <GlobalAttributesTable/>
                        <ModalController/>
                    </>,
                    state,
                );
            }

            async function clickActionsAndFindDelete(fieldId: string) {
                await userEvent.click(await screen.findByTestId(`global-attribute-actions-${fieldId}`));
                return (await screen.findAllByRole('menuitem')).find((el) => el.textContent?.includes('Delete attribute'))!;
            }

            // Plugin owners trigger the inventory fetch, which remounts an open menu.
            async function findDeleteOnSettledTemplate() {
                await waitFor(() => expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by'));
                await waitFor(() => expect(Client4.getPluginStatuses).toHaveBeenCalled());
                await act(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                });
                return clickActionsAndFindDelete('template-1');
            }

            async function expectInertDisabledDelete(del: HTMLElement, reason: string) {
                expect(del).toHaveAttribute('aria-disabled', 'true');
                expect(del).toHaveTextContent(reason);
                await userEvent.click(del, {pointerEventsCheck: 0});
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
                expect(deletePropertyField).not.toHaveBeenCalled();
            }

            it('disables Delete with the owner named on a template row whose owner plugin is installed', async () => {
                mockOwnedTemplate([owner('com.acme.scim')]);
                renderOwned('com.acme.scim');

                const del = await findDeleteOnSettledTemplate();
                await expectInertDisabledDelete(del, 'Managed by com.acme.scim');
            });

            it('disables Delete on a standalone user attribute owned by a service', async () => {
                getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                    if (opts?.cursorId || objectType !== 'user') {
                        return Promise.resolve([]);
                    }
                    return Promise.resolve([makeField({id: 'user-1', name: 'standalone', object_type: 'user', attrs: {owners: [owner('svc-sync', 'service')]}})]);
                });
                renderOwned();

                await expectInertDisabledDelete(await clickActionsAndFindDelete('user-1'), 'Managed by svc-sync');
            });

            it('enables Delete once every owner plugin is uninstalled and confirms naming them', async () => {
                deletePropertyField.mockResolvedValue({status: 'OK'});
                mockOwnedTemplate([owner('com.acme.one'), owner('com.acme.two')]);
                renderOwned();

                const del = await findDeleteOnSettledTemplate();
                expect(del).not.toHaveAttribute('aria-disabled', 'true');
                await userEvent.click(del);

                expect(await screen.findByText(/no longer installed/i)).toHaveTextContent('com.acme.one and com.acme.two');

                await userEvent.click(await screen.findByRole('button', {name: /^delete$/i}));
                await waitFor(() => {
                    expect(deletePropertyField).toHaveBeenCalledWith('access_control', 'template', 'template-1');
                });
            });

            it('keeps Delete disabled when an uninstalled plugin shares ownership with a service', async () => {
                mockOwnedTemplate([owner('com.acme.gone'), owner('svc-sync', 'service')]);
                renderOwned();

                const del = await findDeleteOnSettledTemplate();
                await expectInertDisabledDelete(del, 'Managed by');
            });

            it('keeps Delete disabled on an owned row while the plugin inventory is still in flight', async () => {
                const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses').mockImplementation(() => new Promise(() => {}));
                mockOwnedTemplate([owner('com.acme.gone')]);
                renderOwned();

                await waitFor(() => expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed by com.acme.gone'));
                expect(await clickActionsAndFindDelete('template-1')).toHaveAttribute('aria-disabled', 'true');

                getPluginStatuses.mockRestore();
            });

            it('keeps Delete disabled on a template row while the user fields have not loaded', async () => {
                getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                    if (opts?.cursorId) {
                        return Promise.resolve([]);
                    }
                    if (objectType === 'template') {
                        return Promise.resolve([makeField({id: 'template-1', name: 'department'})]);
                    }
                    return objectType === 'user' ? new Promise(() => {}) : Promise.resolve([]);
                });
                renderOwned();

                expect(await clickActionsAndFindDelete('template-1')).toHaveAttribute('aria-disabled', 'true');
            });
        });

        it('omits the plugin explanation for an ordinary attribute', async () => {
            renderTable([makeField({attrs: {display_name: 'Department'}})]);

            await openDeleteModal();

            expect(await screen.findByText(/permanently remove its definition/i)).toBeInTheDocument();
            expect(screen.queryByText(/no longer installed/i)).not.toBeInTheDocument();
        });
    });

    describe('Classification Markings row', () => {
        it('renders the subtitle and an open-in-new link with no actions menu when the field matches and the destination is reachable', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            expect(await screen.findByTestId('global-attribute-name')).toHaveTextContent('Classification');
            expect(await screen.findByTestId('global-attribute-classification-subtitle-field-1')).toHaveTextContent('Definition is read-only');

            const link = screen.getByTestId('global-attribute-classification-link-field-1');
            expect(link).toHaveAttribute('href', CLASSIFICATIONS_MARKINGS_ADMIN_URL);
            expect(link).toHaveAccessibleName('Open Classification Markings');

            // * The definition is edited on Classification Markings; this row must not
            // offer a duplicate Edit/More-actions menu next to the open-in-new link
            expect(screen.queryByTestId('global-attribute-actions-field-1')).not.toBeInTheDocument();

            // * The Source column also identifies this row's true source, rather than the
            // generic "Managed here" every other native field gets
            expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Classification Markings');
        });

        it('offers the link alone when ChannelAttributes is off, since the attribute page is hidden then', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState({channelAttributesFlagOn: false}));

            expect(await screen.findByTestId('global-attribute-classification-link-field-1')).toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-actions-field-1')).not.toBeInTheDocument();
        });

        it('hides the Classification row when the destination is not reachable (flag off / no license)', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            // getBaseState() has no license/FeatureFlags set, so the reachability check is false.
            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await waitFor(() => expect(getPropertyFields).toHaveBeenCalled());
            expect(screen.queryByTestId('global-attribute-name')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-actions-field-1')).not.toBeInTheDocument();
        });

        it('hides the Classification row when the license is Advanced but the ClassificationMarkings flag is off', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState({classificationMarkingsFlagOn: false}));

            await waitFor(() => expect(getPropertyFields).toHaveBeenCalled());
            expect(screen.queryByTestId('global-attribute-name')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-actions-field-1')).not.toBeInTheDocument();
        });

        it('hides the Classification row when ClassificationMarkings is on but the license is below Enterprise Advanced', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            // Enterprise (not Advanced) can open Attribute Management but not Classification
            // Markings — hide the row rather than offering an ordinary Edit/Delete menu.
            renderWithContext(<GlobalAttributesTable/>, getReachableState({licenseSku: 'enterprise'}));

            await waitFor(() => expect(getPropertyFields).toHaveBeenCalled());
            expect(screen.queryByTestId('global-attribute-name')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-actions-field-1')).not.toBeInTheDocument();
        });

        it('renders the open-in-new link on mobile with its tooltip disabled', async () => {
            getPropertyFields.mockResolvedValueOnce([makeClassificationField()]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getMobileState());

            const link = await screen.findByTestId('global-attribute-classification-link-field-1');
            expect(link).toHaveAttribute('href', CLASSIFICATIONS_MARKINGS_ADMIN_URL);
            expect(link).toHaveAccessibleName('Open Classification Markings');

            // * The tooltip never opens on mobile, even after hovering and waiting past its
            // normal open delay — proves `disabled={isMobileView}` is actually wired up, not
            // just that the link itself renders (which the assertions above already cover).
            await userEvent.hover(link);
            await new Promise((resolve) => setTimeout(resolve, 500));
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('does not dim the name or subtitle, so a read-only definition does not read as a disabled attribute', async () => {
            getPropertyFields.
                mockResolvedValueOnce([makeClassificationField(), makeField({id: 'field-2', attrs: {display_name: 'Program'}})]).
                mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            const [classificationName, ordinaryName] = await screen.findAllByTestId('global-attribute-name');
            expect(classificationName).toHaveTextContent('Classification');
            expect(ordinaryName).toHaveTextContent('Program');

            // * Dimming the row on top of its "Definition is read-only" subtitle made a
            // correctly configured attribute look disabled
            expect(classificationName.className).toBe(ordinaryName.className);
            expect(screen.getByTestId('global-attribute-classification-subtitle-field-1').className).
                toBe('GlobalAttributesTable__subtitle');
        });

        it('leaves an unrelated field (not matching name/object_type/group_id) entirely unaffected even when the destination is reachable', async () => {
            getPropertyFields.mockResolvedValueOnce([makeField({type: 'rank'})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            const trigger = await screen.findByTestId('global-attribute-actions-field-1');
            expect(trigger).toBeInTheDocument();

            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
        });

        it('treats a wrong-typed template named classification as an ordinary attribute, so it can be repaired', async () => {
            // * An admin can create a text attribute called `classification` here, which
            // the Classification Markings page then reports as a conflict. Deleting or
            // renaming it in this table is the repair path that error points at, so the
            // row must keep its Edit and Delete actions.
            getPropertyFields.mockResolvedValueOnce([makeClassificationField({type: 'text', attrs: {}})]).mockResolvedValue([]);

            renderWithContext(<GlobalAttributesTable/>, getReachableState());

            expect(await screen.findByTestId('global-attribute-name')).toHaveTextContent('Classification');
            expect(screen.queryByTestId('global-attribute-classification-subtitle-field-1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('global-attribute-classification-link-field-1')).not.toBeInTheDocument();
            expect(screen.getByTestId('global-attribute-source')).toHaveTextContent('Managed here');

            await userEvent.click(screen.getByTestId('global-attribute-actions-field-1'));

            const items = (await screen.findAllByRole('menuitem')).map((el) => el.textContent);
            expect(items).toEqual(['Edit attribute', 'Delete attribute']);
        });
    });

    describe('Name conflict warning', () => {
        // Keyed on the requested object type (and empty for any paged call) for the
        // same reason as the other multi-scope mocks here: the template scope is
        // fetched first and the resource scopes after it, each paging until it sees
        // an empty page.
        function mockTemplatesAndUserFields(templates: PropertyField[], userFields: PropertyField[]) {
            getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                if (opts?.cursorId) {
                    return Promise.resolve([]);
                }
                if (objectType === 'template') {
                    return Promise.resolve(templates);
                }
                if (objectType === 'user') {
                    return Promise.resolve(userFields);
                }
                return Promise.resolve([]);
            });
        }

        const CONFLICT_TESTID = /^global-attribute-name-conflict-/;

        // Rows carry no accessible name of their own, so each assertion is scoped to
        // the <tr> the named Attribute cell sits in — a warning rendered on a
        // neighbouring row cannot then satisfy one of these.
        //
        // Template rows paint before the user scope lands, and the warning is
        // resolved against that scope, so every lookup waits that out first: "no
        // warning" would otherwise hold for a fetch that had not arrived yet, and a
        // row captured before it does is detached by the time it has (resolving the
        // scopes rebuilds the column definitions, and a rebuilt cell renderer is a
        // new component type to React, which remounts every cell). The Applies-to
        // spinners are the rendered signal to wait on: they show for exactly as long
        // as resourcesLoaded is false.
        async function findRowByName(displayName: string): Promise<HTMLElement> {
            await screen.findAllByTestId('global-attribute-name');
            await waitFor(() => {
                expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
            });

            const cell = screen.getAllByTestId('global-attribute-name').find((candidate) => candidate.textContent === displayName);
            expect(cell).toBeDefined();
            return cell!.closest('tr')!;
        }

        // The template an admin creates without knowing that Classification already
        // owns a user field carrying that name. Only the case differs, which is why
        // the server accepted both (its uniqueness check is case-sensitive).
        const clearanceTemplate = makeField({id: 'template-clearance', name: 'Clearance', attrs: {display_name: 'Clearance'}});
        const classificationTemplate = makeField({id: 'template-classification', name: 'classification', attrs: {display_name: 'Classification'}});

        function makeClearanceUserField(overrides: Partial<PropertyField> = {}): PropertyField {
            return makeField({id: 'user-clearance', name: 'clearance', object_type: 'user', ...overrides});
        }

        it('warns on the row whose name a user field belonging to another template already carries', async () => {
            mockTemplatesAndUserFields(
                [clearanceTemplate, classificationTemplate],
                [makeClearanceUserField({linked_field_id: classificationTemplate.id})],
            );

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const clearanceRow = await findRowByName('Clearance');
            const warning = within(clearanceRow).getByTestId(`global-attribute-name-conflict-${clearanceTemplate.id}`);

            // * Both halves of what this row hides: the unique name an admin would
            // write in a CEL rule, and the attribute that name actually resolves to.
            // Neither is inferable from the row itself, and losing the owner lookup
            // leaves the second one unnamed.
            expect(warning).toHaveAccessibleName(/"clearance"/);
            expect(warning).toHaveAccessibleName(/linked to Classification/);

            // * The owner's own row is not the ambiguous one — its linked child is
            // exactly the field the warning points at, so flagging it too would say
            // the attribute conflicts with itself.
            const classificationRow = await findRowByName('Classification');
            expect(within(classificationRow).queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);
        });

        it('leaves every row unwarned when no user field collides, even one hidden as another template\'s child', async () => {
            // Same shape as the conflicting case above — a template-owned user field
            // that the listing hides — differing only in the name it carries.
            mockTemplatesAndUserFields(
                [clearanceTemplate, classificationTemplate],
                [makeField({id: 'user-department', name: 'department', object_type: 'user', linked_field_id: classificationTemplate.id})],
            );

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await findRowByName('Clearance');

            expect(screen.queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);
        });

        it('does not warn on a template whose own linked user field carries the name', async () => {
            // The ordinary case: every template applied to Users has a linked user
            // field of the same name, so matching on the name alone would put a
            // warning on nearly every row in the table.
            mockTemplatesAndUserFields(
                [clearanceTemplate, classificationTemplate],
                [makeClearanceUserField({linked_field_id: clearanceTemplate.id})],
            );

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const clearanceRow = await findRowByName('Clearance');

            // * The link really did load — without this the absence below would also
            // hold for a user scope that never arrived.
            expect(within(clearanceRow).getByTestId('global-attribute-applies-to')).toHaveTextContent('Users');
            expect(screen.queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);
        });

        it('does not warn about a soft-deleted colliding user field, since the name it held is free', async () => {
            // Identical to the conflicting case apart from delete_at. Two layers have
            // to agree for a tombstone to stay silent — the scope refetch drops
            // deleted fields from the store, and the conflict lookup filters them
            // again — so this pins the outcome rather than either one of them.
            mockTemplatesAndUserFields(
                [clearanceTemplate, classificationTemplate],
                [makeClearanceUserField({linked_field_id: classificationTemplate.id, delete_at: 1700000000001})],
            );

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await findRowByName('Clearance');

            expect(screen.queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);
        });

        it('names no owner when the colliding user field is standalone', async () => {
            mockTemplatesAndUserFields([clearanceTemplate], [makeClearanceUserField()]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const clearanceRow = await findRowByName('Clearance');
            const warning = within(clearanceRow).getByTestId(`global-attribute-name-conflict-${clearanceTemplate.id}`);

            expect(warning).toHaveAccessibleName(/standalone user attribute named "clearance"/);
            expect(warning).not.toHaveAccessibleName(/linked to/);

            // * A standalone user field gets its own row here, and it is the field
            // the warning above describes — warning on it as well would have it
            // conflict with itself.
            const userFieldRow = await findRowByName('clearance');
            expect(within(userFieldRow).queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);
        });

        // The name and the label are deliberately unrelated in both of these, in
        // opposite directions. A fixture where they agree is satisfied just as well
        // by matching on the Attribute column's text, and matching on the name is
        // the entire point: that is what a CEL rule spells as
        // user.attributes.<name>, while the label is free text an admin can set to
        // anything.
        const mislabelledClearanceTemplate = makeField({id: 'template-mislabelled', name: 'clearance', attrs: {display_name: 'Security Level'}});
        const misleadinglyLabelledTemplate = makeField({id: 'template-misleading', name: 'security_level', attrs: {display_name: 'Clearance'}});

        it('warns on the row whose internal name collides, even though its label is nothing like it', async () => {
            mockTemplatesAndUserFields(
                [mislabelledClearanceTemplate, classificationTemplate],
                [makeClearanceUserField({linked_field_id: classificationTemplate.id})],
            );

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const row = await findRowByName('Security Level');
            const warning = within(row).getByTestId(`global-attribute-name-conflict-${mislabelledClearanceTemplate.id}`);

            expect(warning).toHaveAccessibleName(/"clearance"/);
            expect(warning).toHaveAccessibleName(/linked to Classification/);
        });

        it('leaves the row whose label collides but whose internal name does not unwarned', async () => {
            mockTemplatesAndUserFields(
                [misleadinglyLabelledTemplate, classificationTemplate],
                [makeClearanceUserField({linked_field_id: classificationTemplate.id})],
            );

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            await findRowByName('Clearance');

            // * `security_level` is free for this template to use: nothing an admin
            // writes in a policy resolves to both it and the clearance field.
            expect(screen.queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);
        });

        it('does not warn from a cached user field after the user scope fetch fails', async () => {
            // A scope this page failed to fetch (or that the license never asked
            // for) is dropped from the table rather than read back out of Redux: the
            // cached copy can predate a rename or a delete, and a warning built from
            // it would name an attribute that is no longer there.
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const cachedClearanceField = makeClearanceUserField({linked_field_id: classificationTemplate.id});
            getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                if (opts?.cursorId) {
                    return Promise.resolve([]);
                }
                if (objectType === 'template') {
                    return Promise.resolve([clearanceTemplate, classificationTemplate]);
                }
                if (objectType === 'user') {
                    return Promise.reject(new Error('network'));
                }
                return Promise.resolve([]);
            });

            const state = getBaseState();
            state.entities!.properties = {
                groups: {
                    byId: {[ACCESS_CONTROL_GROUP_UUID]: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                    byName: {access_control: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                },
                fields: {
                    byId: {[cachedClearanceField.id]: cachedClearanceField},
                    byObjectType: {
                        user: {[ACCESS_CONTROL_GROUP_UUID]: {[cachedClearanceField.id]: cachedClearanceField}},
                    },
                },
            };

            renderWithContext(<GlobalAttributesTable/>, state);

            await findRowByName('Clearance');

            expect(screen.queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);

            consoleSpy.mockRestore();
        });

        it('says nothing until the scope fetches settle, even with the colliding field already cached', async () => {
            // Same cache as the test above, but the fetch has not answered yet
            // rather than failed. Which of the two it will be is exactly what is
            // unknown during this window, so the warning waits: a cache this page
            // has not re-confirmed can name an attribute that was renamed or
            // deleted since, and the table would then point at nothing.
            let resolveUser: (value: PropertyField[]) => void = () => {};
            const userPending = new Promise<PropertyField[]>((resolve) => {
                resolveUser = resolve;
            });

            const cachedClearanceField = makeClearanceUserField({linked_field_id: classificationTemplate.id});
            getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                if (opts?.cursorId) {
                    return Promise.resolve([]);
                }
                if (objectType === 'template') {
                    return Promise.resolve([clearanceTemplate, classificationTemplate]);
                }
                if (objectType === 'user') {
                    return userPending;
                }
                return Promise.resolve([]);
            });

            const state = getBaseState();
            state.entities!.properties = {
                groups: {
                    byId: {[ACCESS_CONTROL_GROUP_UUID]: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                    byName: {access_control: {id: ACCESS_CONTROL_GROUP_UUID, name: 'access_control'}},
                },
                fields: {
                    byId: {[cachedClearanceField.id]: cachedClearanceField},
                    byObjectType: {
                        user: {[ACCESS_CONTROL_GROUP_UUID]: {[cachedClearanceField.id]: cachedClearanceField}},
                    },
                },
            };

            renderWithContext(<GlobalAttributesTable/>, state);

            // Template rows paint ahead of the scope fetches, so the row is on
            // screen during the window this is about, with its Applies-to spinner
            // still showing.
            const clearanceCell = (await screen.findAllByTestId('global-attribute-name')).
                find((candidate) => candidate.textContent === 'Clearance');
            expect(clearanceCell).toBeDefined();
            const pendingRow = clearanceCell!.closest('tr')!;
            expect(within(pendingRow).getByTestId('loadingSpinner')).toBeInTheDocument();
            expect(screen.queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);

            await act(async () => {
                resolveUser([cachedClearanceField]);
                await userPending;
            });

            // * The wait is a delay, not a suppression: the same cached field
            // warns as soon as the fetch confirms it is still there.
            const clearanceRow = await findRowByName('Clearance');
            expect(within(clearanceRow).getByTestId(`global-attribute-name-conflict-${clearanceTemplate.id}`)).
                toHaveAccessibleName(/linked to Classification/);
        });

        it('warns on both of two standalone user rows whose names differ only in case', async () => {
            // The warning is computed per row, not only for templates, and a
            // standalone user field gets a row of its own. The server's
            // case-sensitive uniqueness check let both of these be created, so each
            // is the other's conflict.
            mockTemplatesAndUserFields([], [
                makeField({id: 'user-clearance-lower', name: 'clearance', object_type: 'user'}),
                makeField({id: 'user-clearance-upper', name: 'Clearance', object_type: 'user'}),
            ]);

            renderWithContext(<GlobalAttributesTable/>, getBaseState());

            const lowercaseRow = await findRowByName('clearance');
            expect(within(lowercaseRow).getByTestId('global-attribute-name-conflict-user-clearance-lower')).
                toHaveAccessibleName(/standalone user attribute named "Clearance"/);

            const uppercaseRow = await findRowByName('Clearance');
            expect(within(uppercaseRow).getByTestId('global-attribute-name-conflict-user-clearance-upper')).
                toHaveAccessibleName(/standalone user attribute named "clearance"/);
        });

        it('leaves a standalone channel field unwarned about a same-named user field', async () => {
            // A channel field is resource.attributes.clearance in CEL, which
            // never resolves to the user field however alike the two names look,
            // so neither shadows the other in a policy and the warning's copy
            // would be describing a collision that cannot happen.
            const channelClearance = makeField({
                id: 'channel-clearance',
                name: 'clearance',
                object_type: 'channel',
                attrs: {display_name: 'Channel Clearance'},
            });
            const userClearance = makeField({
                id: 'user-clearance-standalone',
                name: 'clearance',
                object_type: 'user',
                attrs: {display_name: 'User Clearance'},
            });

            getPropertyFields.mockImplementation((_group, objectType, _targetType, _targetId, opts) => {
                if (opts?.cursorId) {
                    return Promise.resolve([]);
                }
                if (objectType === 'user') {
                    return Promise.resolve([userClearance]);
                }
                if (objectType === 'channel') {
                    return Promise.resolve([channelClearance]);
                }
                return Promise.resolve([]);
            });

            renderWithContext(<GlobalAttributesTable/>, getAllScopesState());

            const channelRow = await findRowByName('Channel Clearance');
            expect(within(channelRow).queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);

            // Nor the user field itself: it is the other side of the comparison,
            // and a row is always excluded from its own.
            const userRow = await findRowByName('User Clearance');
            expect(within(userRow).queryAllByTestId(CONFLICT_TESTID)).toHaveLength(0);
        });

        describe('warning affordance', () => {
            beforeEach(() => {
                mockTemplatesAndUserFields(
                    [clearanceTemplate, classificationTemplate],
                    [makeClearanceUserField({linked_field_id: classificationTemplate.id})],
                );
            });

            async function findWarning(): Promise<HTMLElement> {
                const clearanceRow = await findRowByName('Clearance');
                return within(clearanceRow).getByTestId(`global-attribute-name-conflict-${clearanceTemplate.id}`);
            }

            it('reveals the warning on hover, so the mouse path spells out the conflict in full', async () => {
                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                const warning = await findWarning();
                expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

                await userEvent.hover(warning);

                const tooltip = await screen.findByRole('tooltip', {hidden: true}, {timeout: 2000});
                expect(tooltip).toHaveTextContent('A user attribute named "clearance" already exists and is linked to Classification.');
            });

            it('is an icon with a role that admits a name, so it can neither ship invisible nor unannounceable', async () => {
                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                const warning = await findWarning();

                // `img` is what lets aria-label be announced on a span whose only
                // content is decoration. Asserted on the attribute rather than
                // through a query by role, because testing-library computes an
                // accessible name for the label with or without it while real
                // assistive tech does not.
                expect(warning).toHaveAttribute('role', 'img');

                // And there is something to see. Asserted structurally, for the
                // same reason the read-only resource icons are in
                // applies_to_card.test: the icon is aria-hidden and has nothing a
                // query by role or accessible name could find, so without this,
                // deleting it would leave an empty focusable span every other
                // assertion here is happy with.
                const icon = warning.querySelector('svg');
                expect(icon).not.toBeNull();
                expect(icon).toHaveAttribute('aria-hidden', 'true');
            });

            it('takes keyboard focus, so the same warning is reachable without a mouse', async () => {
                renderWithContext(<GlobalAttributesTable/>, getBaseState());

                const warning = await findWarning();

                // Tabbed to from the top of the document rather than focused
                // directly: the icon carries no interactive role of its own, so
                // being a tab stop at all is the affordance.
                for (let tabs = 0; tabs < 20 && document.activeElement !== warning; tabs++) {
                    await userEvent.tab(); // eslint-disable-line no-await-in-loop
                }

                expect(warning).toHaveFocus();

                // * Focus, not just hover, opens the tooltip — a tab stop that
                // revealed nothing would be a dead end.
                const tooltip = await screen.findByRole('tooltip', {hidden: true}, {timeout: 2000});
                expect(tooltip).toHaveTextContent('A user attribute named "clearance" already exists and is linked to Classification.');
            });
        });
    });
});

describe('getDisplayName', () => {
    it('prefers attrs.display_name over the internal name', () => {
        expect(getDisplayName(makeField({name: 'internal_name', attrs: {display_name: 'Human Name'}}))).toBe('Human Name');
    });

    it('falls back to the internal name when no display_name is set', () => {
        expect(getDisplayName(makeField({name: 'internal_name', attrs: {}}))).toBe('internal_name');
    });

    it('title-cases the classification template name so the listing matches the edit page', () => {
        expect(getDisplayName(makeClassificationField())).toBe('Classification');
    });
});

describe('getSourceKind', () => {
    it('returns plugin only when both source_plugin_id and protected are set', () => {
        expect(getSourceKind(makeField({attrs: {source_plugin_id: 'p', protected: true}}))).toBe('plugin');
        expect(getSourceKind(makeField({attrs: {source_plugin_id: 'p', protected: false}}))).not.toBe('plugin');
    });

    it('prefers plugin over ldap/saml when both signals are present on the same field', () => {
        expect(getSourceKind(makeField({attrs: {source_plugin_id: 'p', protected: true, ldap: 'x', saml: 'y'}}))).toBe('plugin');
    });

    it('follows the ticket order: plugin, then both, then ldap, then saml, then managed', () => {
        expect(getSourceKind(makeField({attrs: {ldap: 'x', saml: 'y'}}))).toBe('ldap_and_saml');
        expect(getSourceKind(makeField({attrs: {ldap: 'x'}}))).toBe('ldap');
        expect(getSourceKind(makeField({attrs: {saml: 'y'}}))).toBe('saml');
        expect(getSourceKind(makeField({attrs: {}}))).toBe('managed');
    });
});

describe('isClassificationMarkingsField', () => {
    const groupId = 'accesscontrolgroupuuid001';

    it('returns true only when name, type, object_type, and group_id all match', () => {
        const field = makeClassificationField({group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(true);
    });

    it('returns false when the name matches but object_type does not', () => {
        const field = makeClassificationField({object_type: 'system', group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });

    it('returns false when the name and object_type match but group_id does not', () => {
        const field = makeClassificationField({group_id: 'some-other-group'});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });

    it('returns false when object_type and group_id match but the name does not', () => {
        const field = makeClassificationField({name: 'not_classification', group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });

    it('returns false when only the type does not match, so it stays an ordinary attribute', () => {
        const field = makeClassificationField({type: 'text', group_id: groupId});
        expect(isClassificationMarkingsField(field, groupId)).toBe(false);
    });
});
