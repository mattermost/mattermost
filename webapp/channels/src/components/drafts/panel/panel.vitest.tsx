// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import Panel from './panel';

describe('components/drafts/panel/', () => {
    function Component() {
        return null;
    }
    const baseProps = {
        children: <Component/>,
        onClick: vi.fn(),
        hasError: false,
    };

    test('should match snapshot', () => {
        const {container} = render(
            <Panel
                {...baseProps}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
