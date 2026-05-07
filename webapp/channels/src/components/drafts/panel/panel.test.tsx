// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/react_testing_utils';

import Panel from './panel';

describe('components/drafts/panel/', () => {
    function Component() {
        return null;
    }
    const baseProps = {
        children: <Component/>,
        onClick: jest.fn(),
        hasError: false,
    };

    it('should match snapshot', () => {
        const {container} = render(
            <Panel
                {...baseProps}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
