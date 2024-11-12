// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';
import mockStore from 'tests/test_store';
import Constants from 'utils/constants';
import {wrapIntl} from 'utils/test_intl';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import DraftTitle from './draft_title';

describe('components/drafts/draft_actions', () => {
    const channel = {
        type: 'O',
        display_name: 'Test Channel',
    } as Channel;

    const baseProps = {
        channel,
        membersCount: 5,
        selfDraft: false,
        teammate: {} as UserProfile,
        teammateId: '',
        type: 'channel' as 'channel' | 'thread',
    };

    it('should match snapshot', () => {
        const store = mockStore();

        const {container} = render(wrapIntl(
            <Provider store={store}>
                <DraftTitle
                    {...baseProps}
                />
            </Provider>,
        ));
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for self draft', () => {
        const store = mockStore();

        const props = {
            ...baseProps,
            selfDraft: true,
        };

        const {container} = render(wrapIntl(
            <Provider store={store}>
                <DraftTitle
                    {...props}
                />
            </Provider>,
        ));
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for private channel', () => {
        const store = mockStore();
        const channel = {
            type: Constants.PRIVATE_CHANNEL,
            display_name: 'Test Channel',
        } as Channel;
        const props = {
            ...baseProps,
            channel,
        };

        const {container} = render(wrapIntl(
            <Provider store={store}>
                <DraftTitle
                    {...props}
                />
            </Provider>,
        ));
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for DM channel', () => {
        const store = mockStore();
        const channel = {
            type: Constants.DM_CHANNEL,
            display_name: 'Test Channel',
        } as Channel;
        const props = {
            ...baseProps,
            channel,
        };

        const {container} = render(wrapIntl(
            <Provider store={store}>
                <DraftTitle
                    {...props}
                />
            </Provider>,
        ));
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for DM channel with teammate', () => {
        const store = mockStore();
        const channel = {
            type: Constants.DM_CHANNEL,
            display_name: 'Test Channel',
        } as Channel;
        const props = {
            ...baseProps,
            channel,
            teammate: {
                username: 'username',
                id: 'id',
                last_picture_update: 1000,
            } as UserProfile,
        };

        const {container} = render(wrapIntl(
            <Provider store={store}>
                <DraftTitle
                    {...props}
                />
            </Provider>,
        ));
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for GM channel', () => {
        const store = mockStore();
        const channel = {
            type: 'G',
            display_name: 'Test Channel',
        } as Channel;

        const props = {
            ...baseProps,
            channel,
        };

        const {container} = render(wrapIntl(
            <Provider store={store}>
                <DraftTitle
                    {...props}
                />
            </Provider>,
        ));
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for thread', () => {
        const store = mockStore();
        const channel = {
            type: Constants.OPEN_CHANNEL,
            display_name: 'Test Channel',
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            type: 'thread' as 'channel' | 'thread',
        };

        const {container} = render(wrapIntl(
            <Provider store={store}>
                <DraftTitle
                    {...props}
                />
            </Provider>,
        ));
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for open channel', () => {
        const store = mockStore();
        const channel = {
            type: Constants.OPEN_CHANNEL,
            display_name: 'Test Channel',
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            type: 'channel' as 'channel' | 'thread',
        };

        const {container} = render(wrapIntl(
            <Provider store={store}>
                <DraftTitle
                    {...props}
                />
            </Provider>,
        ));
        expect(container).toMatchSnapshot();
    });

    it('should fetch members when member count is 0 for GM', () => {
        const store = mockStore();

        const channel = {
            type: 'G',
            display_name: 'Test Channel',
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            membersCount: 0,
            type: 'channel' as 'channel' | 'thread',
        };

        const {container} = render(wrapIntl(
            <Provider store={store}>
                <DraftTitle
                    {...props}
                />
            </Provider>,
        ));
        expect(container).toMatchSnapshot();
    });
});
