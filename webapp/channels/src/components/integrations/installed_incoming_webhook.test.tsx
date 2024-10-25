// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';
import {Router} from 'react-router-dom';

import {wrapIntl} from '@mattermost/components/src/testUtils';
import type {IncomingWebhook} from '@mattermost/types/integrations';

import store from 'stores/redux_store';

import InstalledIncomingWebhook, {matchesFilter} from 'components/integrations/installed_incoming_webhook';

import {getHistory} from 'utils/browser_history';

describe('components/integrations/InstalledIncomingWebhook', () => {
    const incomingWebhook: IncomingWebhook = {
        id: '9w96t4nhbfdiij64wfqors4i1r',
        channel_id: '1jiw9kphbjrntfyrm7xpdcya4o',
        create_at: 1502455422406,
        delete_at: 0,
        description: 'build status',
        display_name: 'build',
        team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
        update_at: 1502455422406,
        user_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        username: 'username',
        icon_url: 'http://test/icon.png',
        channel_locked: false,
    };

    const teamId = 'testteamid';

    const ComponentWrapper = ({children}: {children: React.ReactElement<IncomingWebhook>}) => {
        return (
            <>
                {wrapIntl(
                    <Provider store={store}>
                        <Router history={getHistory()}>
                            {children}
                        </Router>
                    </Provider>,
                )}
            </>
        );
    };

    test('should match snapshot', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const {asFragment} = render(
            <ComponentWrapper>
                <InstalledIncomingWebhook
                    key={1}
                    incomingWebhook={incomingWebhook}
                    onDelete={emptyFunction}
                    creator={{username: 'creator'}}
                    canChange={true}
                    team={{
                        id: teamId,
                        name: 'test',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        type: 'O',
                        display_name: 'name',
                        scheme_id: 'id',
                        allow_open_invite: false,
                        group_constrained: false,
                        description: '',
                        email: '',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '',
                    }}
                    channel={{
                        id: '1jiw9kphbjrntfyrm7xpdcya4o',
                        name: 'town-square',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        team_id: teamId,
                        type: 'O',
                        display_name: 'name',
                        header: 'header',
                        purpose: 'purpose',
                        last_post_at: 0,
                        last_root_post_at: 0,
                        creator_id: 'id',
                        scheme_id: 'id',
                        group_constrained: false,
                    }}
                />
            </ComponentWrapper>,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    test('should not have edit and delete actions if user does not have permissions to change', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const {container} = render(
            <ComponentWrapper>
                <InstalledIncomingWebhook
                    key={1}
                    incomingWebhook={incomingWebhook}
                    onDelete={emptyFunction}
                    creator={{username: 'creator'}}
                    canChange={false}
                    team={{
                        id: teamId,
                        name: 'test',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        type: 'O',
                        display_name: 'name',
                        scheme_id: 'id',
                        allow_open_invite: false,
                        group_constrained: false,
                        description: '',
                        email: '',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '',
                    }}
                    channel={{
                        id: '1jiw9kphbjrntfyrm7xpdcya4o',
                        name: 'town-square',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        team_id: teamId,
                        type: 'O',
                        display_name: 'name',
                        header: 'header',
                        purpose: 'purpose',
                        last_post_at: 0,
                        last_root_post_at: 0,
                        creator_id: 'id',
                        scheme_id: 'id',
                        group_constrained: false,
                    }}
                />
            </ComponentWrapper>,
        );
        const element = container.querySelector('.item-actions');
        expect(element).not.toBeInTheDocument();
    });

    test('should have edit and delete actions if user can change webhook', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        render(
            <ComponentWrapper>
                <InstalledIncomingWebhook
                    key={1}
                    incomingWebhook={incomingWebhook}
                    onDelete={emptyFunction}
                    creator={{username: 'creator'}}
                    canChange={true}
                    team={{
                        id: teamId,
                        name: 'test',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        type: 'O',
                        display_name: 'name',
                        scheme_id: 'id',
                        allow_open_invite: false,
                        group_constrained: false,
                        description: '',
                        email: '',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '',
                    }}
                    channel={{
                        id: '1jiw9kphbjrntfyrm7xpdcya4o',
                        name: 'town-square',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        team_id: teamId,
                        type: 'O',
                        display_name: 'name',
                        header: 'header',
                        purpose: 'purpose',
                        last_post_at: 0,
                        last_root_post_at: 0,
                        creator_id: 'id',
                        scheme_id: 'id',
                        group_constrained: false,
                    }}
                />
            </ComponentWrapper>,
        );
        const editElement = screen.getByText('Edit');
        const deleteElement = screen.getByText('Delete');
        expect(editElement).toBeInTheDocument();
        expect(deleteElement).toBeInTheDocument();
    });

    test('Should have the same name and description on view as it has in incomingWebhook', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        render(
            <ComponentWrapper>
                <InstalledIncomingWebhook
                    key={1}
                    incomingWebhook={incomingWebhook}
                    onDelete={emptyFunction}
                    creator={{username: 'creator'}}
                    canChange={false}
                    team={{
                        id: teamId,
                        name: 'test',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        type: 'O',
                        display_name: 'name',
                        scheme_id: 'id',
                        allow_open_invite: false,
                        group_constrained: false,
                        description: '',
                        email: '',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '',
                    }}
                    channel={{
                        id: '1jiw9kphbjrntfyrm7xpdcya4o',
                        name: 'town-square',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        team_id: teamId,
                        type: 'O',
                        display_name: 'name',
                        header: 'header',
                        purpose: 'purpose',
                        last_post_at: 0,
                        last_root_post_at: 0,
                        creator_id: 'id',
                        scheme_id: 'id',
                        group_constrained: false,
                    }}
                />
            </ComponentWrapper>,
        );
        const description = screen.getByText('build status');
        const name = screen.getByText('build');

        expect(description).toBeInTheDocument();
        expect(name).toBeInTheDocument();
    });

    test('Should not display description as it is null', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        const newIncomingWebhook: IncomingWebhook = {...incomingWebhook, description: ''};
        const {container} = render(
            <ComponentWrapper>
                <InstalledIncomingWebhook
                    key={1}
                    incomingWebhook={newIncomingWebhook}
                    onDelete={emptyFunction}
                    creator={{username: 'creator'}}
                    canChange={false}
                    team={{
                        id: teamId,
                        name: 'test',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        type: 'O',
                        display_name: 'name',
                        scheme_id: 'id',
                        allow_open_invite: false,
                        group_constrained: false,
                        description: '',
                        email: '',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '',
                    }}
                    channel={{
                        id: '1jiw9kphbjrntfyrm7xpdcya4o',
                        name: 'town-square',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        team_id: teamId,
                        type: 'O',
                        display_name: 'name',
                        header: 'header',
                        purpose: 'purpose',
                        last_post_at: 0,
                        last_root_post_at: 0,
                        creator_id: 'id',
                        scheme_id: 'id',
                        group_constrained: false,
                    }}
                />
            </ComponentWrapper>,
        );
        expect(container.querySelector('.item-details__description')).not.toBeInTheDocument();
    });

    test('Should not render any nodes as there are no filtered results', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        const {container} = render(
            <ComponentWrapper>
                <InstalledIncomingWebhook
                    key={1}
                    incomingWebhook={incomingWebhook}
                    onDelete={emptyFunction}
                    creator={{username: 'creator'}}
                    filter={'someLongText'}
                    canChange={false}
                    team={{
                        id: teamId,
                        name: 'test',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        type: 'O',
                        display_name: 'name',
                        scheme_id: 'id',
                        allow_open_invite: false,
                        group_constrained: false,
                        description: '',
                        email: '',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '',
                    }}
                    channel={{
                        id: '1jiw9kphbjrntfyrm7xpdcya4o',
                        name: 'town-square',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        team_id: teamId,
                        type: 'O',
                        display_name: 'name',
                        header: 'header',
                        purpose: 'purpose',
                        last_post_at: 0,
                        last_root_post_at: 0,
                        creator_id: 'id',
                        scheme_id: 'id',
                        group_constrained: false,
                    }}
                />
            </ComponentWrapper>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    test('Should render a webhook item as filtered result is true', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        const {container} = render(
            <ComponentWrapper>
                <InstalledIncomingWebhook
                    key={1}
                    incomingWebhook={incomingWebhook}
                    onDelete={emptyFunction}
                    creator={{username: 'creator'}}
                    filter={'buil'}
                    canChange={true}
                    team={{
                        id: teamId,
                        name: 'test',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        type: 'O',
                        display_name: 'name',
                        scheme_id: 'id',
                        allow_open_invite: false,
                        group_constrained: false,
                        description: '',
                        email: '',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '',
                    }}
                    channel={{
                        id: '1jiw9kphbjrntfyrm7xpdcya4o',
                        name: 'town-square',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        team_id: teamId,
                        type: 'O',
                        display_name: 'name',
                        header: 'header',
                        purpose: 'purpose',
                        last_post_at: 0,
                        last_root_post_at: 0,
                        creator_id: 'id',
                        scheme_id: 'id',
                        group_constrained: false,
                    }}
                />
            </ComponentWrapper>,
        );
        expect(container.querySelector('.item-details')).toBeInTheDocument();
    });

    test('Webhooks should have the associated channel', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function
        const {container} = render(
            <ComponentWrapper>
                <InstalledIncomingWebhook
                    key={1}
                    incomingWebhook={incomingWebhook}
                    onDelete={emptyFunction}
                    creator={{username: 'creator'}}
                    filter={'buil'}
                    canChange={true}
                    team={{
                        id: teamId,
                        name: 'test',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        type: 'O',
                        display_name: 'name',
                        scheme_id: 'id',
                        allow_open_invite: false,
                        group_constrained: false,
                        description: '',
                        email: '',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '',
                    }}
                    channel={{
                        id: '1jiw9kphbjrntfyrm7xpdcya4o',
                        name: 'town-square',
                        create_at: 1502455422406,
                        delete_at: 0,
                        update_at: 1502455422406,
                        team_id: teamId,
                        type: 'O',
                        display_name: 'Town Square',
                        header: 'header',
                        purpose: 'purpose',
                        last_post_at: 0,
                        last_root_post_at: 0,
                        creator_id: 'id',
                        scheme_id: 'id',
                        group_constrained: false,
                    }}
                />
            </ComponentWrapper>,
        );
        expect(container.querySelector('.item-details__channel_name')).toBeInTheDocument();
    });

    test('matchesFilter should return true as it allows filter by channel display_name', () => {
        const result = matchesFilter(
            incomingWebhook,
            {
                id: '1jiw9kphbjrntfyrm7xpdcya4o',
                name: 'town-square',
                create_at: 1502455422406,
                delete_at: 0,
                update_at: 1502455422406,
                team_id: teamId,
                type: 'O',
                display_name: 'TS Display Name',
                header: 'header',
                purpose: 'purpose',
                last_post_at: 0,
                last_root_post_at: 0,
                creator_id: 'id',
                scheme_id: 'id',
                group_constrained: false,
            },
            'ts disp',
        );
        expect(result).toBe(true);
    });

    test("matchesFilter should return false, as filter doesn't match with channel display_name", () => {
        const result = matchesFilter(
            incomingWebhook,
            {
                id: '1jiw9kphbjrntfyrm7xpdcya4o',
                name: 'town-square',
                create_at: 1502455422406,
                delete_at: 0,
                update_at: 1502455422406,
                team_id: teamId,
                type: 'O',
                display_name: 'TS Display Name',
                header: 'header',
                purpose: 'purpose',
                last_post_at: 0,
                last_root_post_at: 0,
                creator_id: 'id',
                scheme_id: 'id',
                group_constrained: false,
            },
            'ts disop',
        );
        expect(result).toBe(false);
    });
});
