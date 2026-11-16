// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import DraftTitle from './draft_title';

describe('components/drafts/draft_actions', () => {
    const channel = {
        type: 'O',
        display_name: 'Test Channel',
        delete_at: 0,
    } as Channel;

    const baseProps = {
        channel,
        membersCount: 5,
        selfDraft: false,
        teammate: {} as UserProfile,
        teammateId: '',
        type: 'channel' as 'channel' | 'thread',
    };

    it('should render', () => {
        const {container} = renderWithContext(
            <DraftTitle
                {...baseProps}
            />,
        );
        expect(container.querySelector('i.icon')).toHaveClass('icon-globe');
    });

    it('should render for self draft', () => {
        const props = {
            ...baseProps,
            selfDraft: true,
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container.querySelector('i.icon')).toHaveClass('icon-globe');
    });

    it('should render for private channel', () => {
        const channel = {
            type: Constants.PRIVATE_CHANNEL,
            display_name: 'Test Channel',
            delete_at: 0,
        } as Channel;
        const props = {
            ...baseProps,
            channel,
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container.querySelector('i.icon')).toHaveClass('icon-lock-outline');
    });

    it('should render for thread', () => {
        const channel = {
            type: Constants.OPEN_CHANNEL,
            display_name: 'Test Channel',
            delete_at: 0,
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            type: 'thread' as 'channel' | 'thread',
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container.querySelector('i.icon')).toHaveClass('icon-globe');
    });

    it('should render for open channel', () => {
        const channel = {
            type: Constants.OPEN_CHANNEL,
            display_name: 'Test Channel',
            delete_at: 0,
        } as Channel;

        const props = {
            ...baseProps,
            channel,
            type: 'channel' as 'channel' | 'thread',
        };

        const {container} = renderWithContext(
            <DraftTitle
                {...props}
            />,
        );
        expect(container.querySelector('i.icon')).toHaveClass('icon-globe');
    });
});
