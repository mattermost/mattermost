// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import AddOAuthApp from 'components/integrations/add_oauth_app/add_oauth_app';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AddOAuthApp', () => {
    const emptyFunction = vi.fn();
    const team = TestHelper.getTeamMock({
        id: 'dbcxd9wpzpbpfp8pad78xj12pr',
        name: 'test',
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <AddOAuthApp
                team={team}
                actions={{addOAuthApp: emptyFunction}}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
