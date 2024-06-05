// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import type {ComponentProps} from 'react';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditedPostItem from './edited_post_item';

import RestorePostModal from '../restore_post_modal';

describe('components/post_edit_history/edited_post_item', () => {
    const baseProps: ComponentProps<typeof EditedPostItem> = {
        post: TestHelper.getPostMock({
            id: 'post_id',
            message: 'post message',
        }),
        isCurrent: false,
        theme: {} as Theme,
        postCurrentVersion: TestHelper.getPostMock({
            id: 'post_current_version_id',
            message: 'post current version message',
        }),
        actions: {
            editPost: jest.fn(),
            closeRightHandSide: jest.fn(),
            openModal: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<EditedPostItem {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });
    test('should match snapshot when isCurrent is true', () => {
        const props = {
            ...baseProps,
            isCurrent: true,
        };
        const wrapper = shallow(<EditedPostItem {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
    test('clicking on the restore button should call openRestorePostModal', () => {
        const wrapper = shallow(<EditedPostItem {...baseProps}/>);

        const restoreButton = wrapper.find('.restore-icon').first();
        restoreButton.simulate('click', {stopPropagation: jest.fn()});

        expect(baseProps.actions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.RESTORE_POST_MODAL,
            dialogType: RestorePostModal,
            dialogProps: {
                post: baseProps.post,
                postHeader: expect.anything(),
                actions: {
                    handleRestore: expect.any(Function),
                },
            },
        });
    });

    test('clicking on the title container should toggle post', () => {
        const wrapper = shallow(<EditedPostItem {...baseProps}/>);
        const titleContainer = wrapper.find('.edit-post-history__title__container').first();
        titleContainer.simulate('click', {stopPropagation: jest.fn()});
        expect(wrapper.find('.edit-post-history__container__background').exists()).toBe(true);
        titleContainer.simulate('click', {stopPropagation: jest.fn()});
        expect(wrapper.find('.edit-post-history__container__background').exists()).toBe(false);
    });

    test('clicking inside the expanded container should not collapse it', () => {
        const wrapper = shallow(<EditedPostItem {...baseProps}/>);

        const titleContainer = wrapper.find('.edit-post-history__title__container').first();
        titleContainer.simulate('click', {stopPropagation: jest.fn()});
        expect(wrapper.find('.edit-post-history__container__background').exists()).toBe(true);
        const messageContainer = wrapper.find('.edit-post-history__content_container').first();
        messageContainer.simulate('click', {stopPropagation: jest.fn()});
        expect(wrapper.find('.edit-post-history__container__background').exists()).toBe(true);
    });
});

