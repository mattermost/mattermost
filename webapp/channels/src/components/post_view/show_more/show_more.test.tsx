// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import ShowMore from 'components/post_view/show_more/show_more';

describe('components/post_view/ShowMore', () => {
    const children = (<div><p>{'text'}</p></div>);
    const baseProps = {
        checkOverflow: 0,
        isAttachmentText: false,
        isRHSExpanded: false,
        isRHSOpen: false,
        maxHeight: 200,
        text: 'text',
        compactDisplay: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<ShowMore {...baseProps}>{children}</ShowMore>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PostMessageView on collapsed view', () => {
        const wrapper = shallow(<ShowMore {...baseProps}/>);
        wrapper.setState({isOverflow: true, isCollapsed: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PostMessageView on expanded view', () => {
        const wrapper = shallow(<ShowMore {...baseProps}/>);
        wrapper.setState({isOverflow: true, isCollapsed: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PostAttachment on collapsed view', () => {
        const wrapper = shallow(
            <ShowMore
                {...baseProps}
                isAttachmentText={true}
            />,
        );
        wrapper.setState({isOverflow: true, isCollapsed: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PostAttachment on expanded view', () => {
        const wrapper = shallow(
            <ShowMore
                {...baseProps}
                isAttachmentText={true}
            />,
        );
        wrapper.setState({isOverflow: true, isCollapsed: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PostMessageView on expanded view with compactDisplay', () => {
        const wrapper = shallow(
            <ShowMore
                {...baseProps}
                compactDisplay={true}
            />,
        );
        wrapper.setState({isOverflow: true, isCollapsed: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should call checkTextOverflow', () => {
        const wrapper = shallow(<ShowMore {...baseProps}/>);
        const instance = wrapper.instance() as ShowMore;
        instance.checkTextOverflow = jest.fn();

        expect(instance.checkTextOverflow).not.toBeCalled();

        wrapper.setProps({isRHSExpanded: true});
        expect(instance.checkTextOverflow).toBeCalledTimes(1);

        wrapper.setProps({isRHSExpanded: false});
        expect(instance.checkTextOverflow).toBeCalledTimes(2);

        wrapper.setProps({isRHSOpen: true});
        expect(instance.checkTextOverflow).toBeCalledTimes(3);

        wrapper.setProps({isRHSOpen: false});
        expect(instance.checkTextOverflow).toBeCalledTimes(4);

        wrapper.setProps({text: 'text change'});
        expect(instance.checkTextOverflow).toBeCalledTimes(5);

        wrapper.setProps({text: 'text another change'});
        expect(instance.checkTextOverflow).toBeCalledTimes(6);

        wrapper.setProps({checkOverflow: 1});
        expect(instance.checkTextOverflow).toBeCalledTimes(7);

        wrapper.setProps({checkOverflow: 1});
        expect(instance.checkTextOverflow).toBeCalledTimes(7);
    });
});
