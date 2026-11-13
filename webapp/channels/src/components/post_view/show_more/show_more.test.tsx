// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ShowMore from 'components/post_view/show_more/show_more';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/post_view/ShowMore', () => {
    const baseProps = {
        checkOverflow: 0,
        isAttachmentText: false,
        isRHSExpanded: false,
        isRHSOpen: false,
        maxHeight: 200,
        text: 'text',
        compactDisplay: false,
    };

    test('should call checkTextOverflow', () => {
        const ref = React.createRef<ShowMore>();
        const {rerender} = renderWithContext(
            <ShowMore
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current as ShowMore;
        jest.spyOn(instance, 'checkTextOverflow');

        expect(instance.checkTextOverflow).not.toHaveBeenCalled();

        rerender(
            <ShowMore
                {...baseProps}
                ref={ref}
                isRHSExpanded={true}
            />,
        );
        expect(instance.checkTextOverflow).toHaveBeenCalledTimes(1);

        rerender(
            <ShowMore
                {...baseProps}
                ref={ref}
                isRHSExpanded={false}
            />,
        );
        expect(instance.checkTextOverflow).toHaveBeenCalledTimes(2);

        rerender(
            <ShowMore
                {...baseProps}
                ref={ref}
                isRHSOpen={true}
            />,
        );
        expect(instance.checkTextOverflow).toHaveBeenCalledTimes(3);

        rerender(
            <ShowMore
                {...baseProps}
                ref={ref}
                isRHSOpen={false}
            />,
        );
        expect(instance.checkTextOverflow).toHaveBeenCalledTimes(4);

        rerender(
            <ShowMore
                {...baseProps}
                ref={ref}
                text={'text change'}
            />,
        );
        expect(instance.checkTextOverflow).toHaveBeenCalledTimes(5);

        rerender(
            <ShowMore
                {...baseProps}
                ref={ref}
                text={'text another change'}
            />,
        );
        expect(instance.checkTextOverflow).toHaveBeenCalledTimes(6);

        rerender(
            <ShowMore
                {...baseProps}
                ref={ref}
                checkOverflow={1}
            />,
        );
        expect(instance.checkTextOverflow).toHaveBeenCalledTimes(7);

        rerender(
            <ShowMore
                {...baseProps}
                ref={ref}
                checkOverflow={1}
            />,
        );
        expect(instance.checkTextOverflow).toHaveBeenCalledTimes(7);
    });
});
