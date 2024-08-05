// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import Gate from './gate';

describe('components/permissions_gates', () => {
    const CONTENT = 'The content inside the permission gate';

    describe('Gate', () => {
        for (const hasPermission of [true, false]) {
            for (const invert of [true, false]) {
                test(`hasPermission=${hasPermission}; invert=${invert}; expected=${invert !== hasPermission}`, () => {
                    render(
                        <Gate
                            hasPermission={hasPermission}
                            invert={invert}
                        >
                            <p>{CONTENT}</p>
                        </Gate>,
                    );
                    if (invert === hasPermission) {
                        expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
                    } else {
                        expect(screen.queryByText(CONTENT)).toBeInTheDocument();
                    }
                });
            }
        }
    });
});
