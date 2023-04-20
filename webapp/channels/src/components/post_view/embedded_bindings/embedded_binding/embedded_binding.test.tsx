// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {AppBinding} from '@mattermost/types/apps';

import {MessageAttachment as MessageAttachmentType} from '@mattermost/types/message_attachments';
import {Post} from '@mattermost/types/posts';

import EmbeddedBinding from './embedded_binding';

describe('components/post_view/embedded_bindings/embedded_binding', () => {
    const post = {
        id: 'post_id',
        channel_id: 'channel_id',
    } as Post;

    const embed = {
        app_id: 'app_id',
        bindings: [] as AppBinding[],
        label: 'some text',
        description: 'some title',
    } as AppBinding;

    const baseProps = {
        post,
        embed,
        currentRelativeTeamUrl: 'dummy_team',
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<EmbeddedBinding {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when the attachment has an emoji in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Do you like :pizza:?',
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<EmbeddedBinding {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when the attachment hasn\'t any emojis in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Don\'t you like emojis?',
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<EmbeddedBinding {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when the attachment has a link in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Do you like https://mattermost.com?',
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<EmbeddedBinding {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });
});
