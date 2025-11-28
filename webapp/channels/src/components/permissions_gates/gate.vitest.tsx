// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import {render, screen} from 'tests/vitest_react_testing_utils';

import Gate from './gate';

describe('components/permissions_gates', () => {
    const CONTENT = 'The content inside the permission gate';

    describe('Gate', () => {
        test('hasPermission=true; invert=false; should show content', () => {
            render(
                <Gate
                    hasPermission={true}
                    invert={false}
                >
                    <p>{CONTENT}</p>
                </Gate>,
            );
            expect(screen.queryByText(CONTENT)).toBeInTheDocument();
        });

        test('hasPermission=true; invert=true; should not show content', () => {
            render(
                <Gate
                    hasPermission={true}
                    invert={true}
                >
                    <p>{CONTENT}</p>
                </Gate>,
            );
            expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
        });

        test('hasPermission=false; invert=false; should not show content', () => {
            render(
                <Gate
                    hasPermission={false}
                    invert={false}
                >
                    <p>{CONTENT}</p>
                </Gate>,
            );
            expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
        });

        test('hasPermission=false; invert=true; should show content', () => {
            render(
                <Gate
                    hasPermission={false}
                    invert={true}
                >
                    <p>{CONTENT}</p>
                </Gate>,
            );
            expect(screen.queryByText(CONTENT)).toBeInTheDocument();
        });
    });
});
