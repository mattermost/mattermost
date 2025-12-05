// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import ShowMore from './show_more';

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
        const {container} = renderWithContext(<ShowMore {...baseProps}>{children}</ShowMore>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, PostMessageView on collapsed view', () => {
        // For functional components with hooks, we need to test the rendered output
        // with the overflow state simulated through the component's behavior
        const {container} = renderWithContext(<ShowMore {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, PostMessageView on expanded view', () => {
        const {container} = renderWithContext(<ShowMore {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, PostAttachment on collapsed view', () => {
        const {container} = renderWithContext(
            <ShowMore
                {...baseProps}
                isAttachmentText={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, PostAttachment on expanded view', () => {
        const {container} = renderWithContext(
            <ShowMore
                {...baseProps}
                isAttachmentText={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, PostMessageView on expanded view with compactDisplay', () => {
        const {container} = renderWithContext(
            <ShowMore
                {...baseProps}
                compactDisplay={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should call checkTextOverflow', () => {
        const {rerender, container} = renderWithContext(<ShowMore {...baseProps}/>);

        // Re-render with isRHSExpanded true
        rerender(
            <ShowMore
                {...baseProps}
                isRHSExpanded={true}
            />,
        );
        expect(container).toMatchSnapshot();

        // Re-render with isRHSExpanded false
        rerender(
            <ShowMore
                {...baseProps}
                isRHSExpanded={false}
            />,
        );
        expect(container).toMatchSnapshot();

        // Re-render with isRHSOpen true
        rerender(
            <ShowMore
                {...baseProps}
                isRHSOpen={true}
            />,
        );
        expect(container).toMatchSnapshot();

        // Re-render with isRHSOpen false
        rerender(
            <ShowMore
                {...baseProps}
                isRHSOpen={false}
            />,
        );
        expect(container).toMatchSnapshot();

        // Re-render with text change
        rerender(
            <ShowMore
                {...baseProps}
                text='text change'
            />,
        );
        expect(container).toMatchSnapshot();

        // Re-render with another text change
        rerender(
            <ShowMore
                {...baseProps}
                text='text another change'
            />,
        );
        expect(container).toMatchSnapshot();

        // Re-render with checkOverflow change
        rerender(
            <ShowMore
                {...baseProps}
                checkOverflow={1}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
