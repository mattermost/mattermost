// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {PostAction} from '@mattermost/types/integration_actions';
import type {MessageAttachment as MessageAttachmentType} from '@mattermost/types/message_attachments';
import type {PostImage} from '@mattermost/types/posts';

import ExternalImage from 'components/external_image';
import MessageAttachment from 'components/post_view/message_attachments/message_attachment/message_attachment';

import {Constants} from 'utils/constants';

describe('components/post_view/MessageAttachment', () => {
    const attachment = {
        pretext: 'pretext',
        author_name: 'author_name',
        author_icon: 'author_icon',
        author_link: 'author_link',
        title: 'title',
        title_link: 'title_link',
        text: 'short text',
        image_url: 'image_url',
        thumb_url: 'thumb_url',
        color: '#FFF',
        footer: 'footer',
        footer_icon: 'footer_icon',
    } as MessageAttachmentType;

    const baseProps = {
        postId: 'post_id',
        attachment,
        currentRelativeTeamUrl: 'dummy_team',
        actions: {
            doPostActionWithCookie: jest.fn(),
            openModal: jest.fn(),
        },
        imagesMetadata: {
            image_url: {
                height: 200,
                width: 200,
            } as PostImage,
            thumb_url: {
                height: 200,
                width: 200,
            } as PostImage,
        } as Record<string, PostImage>,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<MessageAttachment {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should change checkOverflow state on handleHeightReceived change', () => {
        const wrapper = shallow<MessageAttachment>(<MessageAttachment {...baseProps}/>);
        const instance = wrapper.instance();

        wrapper.setState({checkOverflow: 0});
        instance.handleHeightReceived(1);
        expect(wrapper.state('checkOverflow')).toEqual(1);

        instance.handleHeightReceived(0);
        expect(wrapper.state('checkOverflow')).toEqual(1);
    });

    test('should match value on renderPostActions', () => {
        let wrapper = shallow<MessageAttachment>(<MessageAttachment {...baseProps}/>);
        expect(wrapper.instance().renderPostActions()).toMatchSnapshot();

        const newAttachment = {
            ...attachment,
            actions: [
                {id: 'action_id_1', name: 'action_name_1'},
                {id: 'action_id_2', name: 'action_name_2'},
                {id: 'action_id_3', name: 'action_name_3', type: 'select', data_source: 'users'},
            ],
        };

        const props = {...baseProps, attachment: newAttachment};

        wrapper = shallow(<MessageAttachment {...props}/>);
        expect(wrapper.instance().renderPostActions()).toMatchSnapshot();
    });

    test('should call actions.doPostActionWithCookie on handleAction', () => {
        const promise = Promise.resolve({data: 123});
        const doPostActionWithCookie = jest.fn(() => promise);
        const openModal = jest.fn();
        const actionId = 'action_id_1';
        const newAttachment = {
            ...attachment,
            actions: [{id: actionId, name: 'action_name_1', cookie: 'cookie-contents'}] as PostAction[],
        };
        const props = {...baseProps, actions: {doPostActionWithCookie, openModal}, attachment: newAttachment};
        const wrapper = shallow<MessageAttachment>(<MessageAttachment {...props}/>);
        expect(wrapper).toMatchSnapshot();
        wrapper.instance().handleAction({
            preventDefault: () => {}, // eslint-disable-line no-empty-function
            currentTarget: {getAttribute: () => {
                return 'attr_some_value';
            }} as any,
        } as React.MouseEvent, []);

        expect(doPostActionWithCookie).toHaveBeenCalledTimes(1);
        expect(doPostActionWithCookie).toBeCalledWith(props.postId, 'attr_some_value', 'attr_some_value');
    });

    test('should call openModal when showModal is called', () => {
        const props = {...baseProps, src: 'https://example.com/image.png'};
        const wrapper = shallow<MessageAttachment>(
            <MessageAttachment {...props}/>,
        );

        wrapper.instance().showModal({preventDefault: () => {}} as unknown as React.KeyboardEvent<HTMLImageElement> | React.MouseEvent<HTMLElement, MouseEvent>, 'https://example.com/image.png');
        expect(props.actions.openModal).toHaveBeenCalledTimes(1);
    });

    test('should match value on getFieldsTable', () => {
        let wrapper = shallow<MessageAttachment>(<MessageAttachment {...baseProps}/>);
        expect(wrapper.instance().getFieldsTable()).toMatchSnapshot();

        const newAttachment = {
            ...attachment,
            fields: [
                {title: 'title_1', value: 'value_1', short: false},
                {title: 'title_2', value: 'value_2', short: false},
            ],
        };

        const props = {...baseProps, attachment: newAttachment};

        wrapper = shallow(<MessageAttachment {...props}/>);
        expect(wrapper.instance().getFieldsTable()).toMatchSnapshot();
    });

    test('should use ExternalImage for images', () => {
        const props = {
            ...baseProps,
            attachment: {
                author_icon: 'http://example.com/author.png',
                image_url: 'http://example.com/image.png',
                thumb_url: 'http://example.com/thumb.png',

                // footer_icon is only rendered if footer is provided
                footer: attachment.footer,
                footer_icon: 'http://example.com/footer.png',
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<MessageAttachment {...props}/>);

        expect(wrapper.find(ExternalImage)).toHaveLength(4);
        expect(wrapper.find(ExternalImage).find({src: props.attachment.author_icon}).exists()).toBe(true);
        expect(wrapper.find(ExternalImage).find({src: props.attachment.image_url}).exists()).toBe(true);
        expect(wrapper.find(ExternalImage).find({src: props.attachment.footer_icon}).exists()).toBe(true);
        expect(wrapper.find(ExternalImage).find({src: props.attachment.thumb_url}).exists()).toBe(true);
    });

    test('should match snapshot when the attachment has an emoji in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Do you like :pizza:?',
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<MessageAttachment {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when the attachment hasn\'t any emojis in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Don\'t you like emojis?',
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<MessageAttachment {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when the attachment has a link in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Do you like https://mattermost.com?',
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<MessageAttachment {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when no footer is provided (even if footer_icon is provided)', () => {
        const props = {
            ...baseProps,
            attachment: {
                ...attachment,
                footer: '',
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<MessageAttachment {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when the footer is truncated', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'footer',
                footer: 'a'.repeat(Constants.MAX_ATTACHMENT_FOOTER_LENGTH + 1),
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<MessageAttachment {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot and render a field with a number value', () => {
        const props = {
            ...baseProps,
            attachment: {
                ...attachment,
                fields: [
                    {
                        title: 'this is the title',
                        value: 1234,
                    },
                ],
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<MessageAttachment {...props}/>);

        expect(wrapper.find('.attachment-field')).toMatchSnapshot();
    });

    test('should not render content box if there is no content', () => {
        const props = {
            ...baseProps,
            attachment: {
                pretext: 'This is a pretext.',
            } as MessageAttachmentType,
        };

        const wrapper = shallow(<MessageAttachment {...props}/>);
        expect(wrapper.find('.attachment')).toMatchSnapshot();
    });
});
