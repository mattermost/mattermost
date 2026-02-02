// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {render} from 'tests/react_testing_utils';

import ProfilePicture from './index';

type Props = ComponentProps<typeof ProfilePicture>;

describe('components/ProfilePicture', () => {
    const baseProps: Props = {
        src: 'http://example.com/image.png',
        status: 'away',
    };

    test('should match snapshot, no user specified, default props', () => {
        const props: Props = baseProps;
        const {container} = render(
            <ProfilePicture {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, profile and src, default props', () => {
        const props: Props = {
            ...baseProps,
            profileSrc: baseProps.src,
            userId: 'uid',
            src: 'http://example.com/emoji.png',
        };
        const {container} = render(
            <ProfilePicture {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, no user specified, overridden props', () => {
        const props: Props = {
            ...baseProps,
            size: 'xl',
        };
        const {container} = render(
            <ProfilePicture {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, user specified', () => {
        const props: Props = {
            ...baseProps,
            username: 'username',
        };
        const {container} = render(
            <ProfilePicture {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, user specified, overridden props', () => {
        const props: Props = {
            ...baseProps,
            username: 'username',
            size: 'xs',
        };
        const {container} = render(
            <ProfilePicture {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
