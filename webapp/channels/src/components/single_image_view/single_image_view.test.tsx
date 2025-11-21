// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import SingleImageView from 'components/single_image_view/single_image_view';
import SizeAwareImage from 'components/size_aware_image';

import {TestHelper} from 'utils/test_helper';

describe('components/SingleImageView', () => {
    const baseProps = {
        postId: 'original_post_id',
        fileInfo: TestHelper.getFileInfoMock({id: 'file_info_id'}),
        isRhsOpen: false,
        isEmbedVisible: true,
        actions: {
            toggleEmbedVisibility: jest.fn(),
            openModal: jest.fn(),
            getFilePublicLink: jest.fn(),
        },
        enablePublicLink: false,
        isFileRejected: false,
    };

    // Mock fetch for thumbnail availability check
    beforeEach(() => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                status: 200, // Simulate thumbnail is allowed
                headers: new Headers(),
            } as Response),
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SingleImageView {...baseProps}/>,
        );

        // Set thumbnailCheckComplete to true to simulate completed check
        wrapper.setState({thumbnailCheckComplete: true, thumbnailRejected: false});
        expect(wrapper).toMatchSnapshot();

        wrapper.setState({loaded: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, SVG image', () => {
        const fileInfo = TestHelper.getFileInfoMock({
            id: 'svg_file_info_id',
            name: 'name_svg',
            extension: 'svg',
        });
        const props = {...baseProps, fileInfo};
        const wrapper = shallow(
            <SingleImageView {...props}/>,
        );

        wrapper.setState({viewPortWidth: 300, thumbnailCheckComplete: true, thumbnailRejected: false});
        expect(wrapper).toMatchSnapshot();

        wrapper.setState({loaded: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should call openModal on handleImageClick', () => {
        const wrapper = shallow(
            <SingleImageView {...baseProps}/>,
        );

        wrapper.setState({thumbnailCheckComplete: true, thumbnailRejected: false});
        wrapper.find(SizeAwareImage).at(0).simulate('click', {preventDefault: () => { }});
        expect(baseProps.actions.openModal).toHaveBeenCalledTimes(1);
    });

    test('should call toggleEmbedVisibility with post id', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                toggleEmbedVisibility: jest.fn(),
            },
        };

        const wrapper = shallow(
            <SingleImageView {...props}/>,
        );

        const instance = wrapper.instance() as SingleImageView;
        const event = {
            stopPropagation: jest.fn(),
        } as unknown as React.MouseEvent<HTMLButtonElement>;
        instance.toggleEmbedVisibility(event);
        expect(props.actions.toggleEmbedVisibility).toHaveBeenCalledTimes(1);
        expect(props.actions.toggleEmbedVisibility).toHaveBeenCalledWith('original_post_id');
    });

    test('should set loaded state on callback of onImageLoaded on SizeAwareImage component', () => {
        const wrapper = shallow(
            <SingleImageView {...baseProps}/>,
        );
        wrapper.setState({thumbnailCheckComplete: true, thumbnailRejected: false});
        expect(wrapper.state('loaded')).toEqual(false);
        wrapper.find(SizeAwareImage).prop('onImageLoaded')?.({height: 0, width: 0});
        expect(wrapper.state('loaded')).toEqual(true);
        expect(wrapper).toMatchSnapshot();
    });

    test('should correctly pass prop down to surround small images with a container', () => {
        const wrapper = shallow(
            <SingleImageView {...baseProps}/>,
        );

        wrapper.setState({thumbnailCheckComplete: true, thumbnailRejected: false});
        expect(wrapper.find(SizeAwareImage).prop('handleSmallImageContainer')).
            toEqual(true);
    });

    test('should not show filename when image is displayed', () => {
        const wrapper = shallow(
            <SingleImageView
                {...baseProps}
                isEmbedVisible={true}
            />,
        );

        wrapper.setState({thumbnailCheckComplete: true, thumbnailRejected: false});
        expect(wrapper.find('.image-header').text()).toHaveLength(0);
    });

    test('should show filename when image is collapsed', () => {
        const wrapper = shallow(
            <SingleImageView
                {...baseProps}
                isEmbedVisible={false}
            />,
        );

        expect(wrapper.find('.image-header').text()).
            toEqual(baseProps.fileInfo.name);
    });

    describe('permalink preview', () => {
        test('should render with permalink styling if in permalink', () => {
            const props = {
                ...baseProps,
                isInPermalink: true,
            };

            const wrapper = shallow(<SingleImageView {...props}/>);

            wrapper.setState({thumbnailCheckComplete: true, thumbnailRejected: false});
            expect(wrapper.find('.image-permalink').exists()).toBe(true);
            expect(wrapper).toMatchSnapshot();
        });
    });

    describe('thumbnail rejection check', () => {
        test('should not render image preview when thumbnail is rejected', () => {
            const wrapper = shallow(
                <SingleImageView {...baseProps}/>,
            );

            wrapper.setState({thumbnailCheckComplete: true, thumbnailRejected: true});

            // Should not find SizeAwareImage when thumbnail is rejected
            expect(wrapper.find(SizeAwareImage)).toHaveLength(0);

            // Should show filename only
            expect(wrapper.find('.image-name').text()).toEqual(baseProps.fileInfo.name);
        });

        test('should render image preview when thumbnail is allowed', () => {
            const wrapper = shallow(
                <SingleImageView {...baseProps}/>,
            );

            wrapper.setState({thumbnailCheckComplete: true, thumbnailRejected: false});

            // Should find SizeAwareImage when thumbnail is allowed
            expect(wrapper.find(SizeAwareImage)).toHaveLength(1);
        });

        test('should show minimal view while thumbnail check is in progress', () => {
            const wrapper = shallow(
                <SingleImageView {...baseProps}/>,
            );

            // thumbnailCheckComplete defaults to false
            expect(wrapper.find(SizeAwareImage)).toHaveLength(0);
            expect(wrapper.find('.image-name').text()).toEqual(baseProps.fileInfo.name);
        });
    });
});
