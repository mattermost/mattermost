// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

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
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SingleImageView {...baseProps}/>,
        );

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

        wrapper.setState({viewPortWidth: 300});
        expect(wrapper).toMatchSnapshot();

        wrapper.setState({loaded: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should call openModal on handleImageClick', () => {
        const wrapper = shallow(
            <SingleImageView {...baseProps}/>,
        );

        wrapper.find('SizeAwareImage').at(0).simulate('click', {preventDefault: () => {}});
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
        instance.toggleEmbedVisibility();
        expect(props.actions.toggleEmbedVisibility).toHaveBeenCalledTimes(1);
        expect(props.actions.toggleEmbedVisibility).toBeCalledWith('original_post_id');
    });

    test('should set loaded state on callback of onImageLoaded on SizeAwareImage component', () => {
        const wrapper = shallow(
            <SingleImageView {...baseProps}/>,
        );
        expect(wrapper.state('loaded')).toEqual(false);
        wrapper.find(SizeAwareImage).prop('onImageLoaded')();
        expect(wrapper.state('loaded')).toEqual(true);
        expect(wrapper).toMatchSnapshot();
    });

    test('should correctly pass prop down to surround small images with a container', () => {
        const wrapper = shallow(
            <SingleImageView {...baseProps}/>,
        );

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

            expect(wrapper.find('.image-permalink').exists()).toBe(true);
            expect(wrapper).toMatchSnapshot();
        });
    });
});
