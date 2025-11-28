// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import AddCommand from 'components/integrations/add_command/add_command';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AddCommand', () => {
    test('should match snapshot', () => {
        const emptyFunction = vi.fn();
        const team = TestHelper.getTeamMock({name: 'test'});

        const {container} = renderWithContext(
            <AddCommand
                team={team}
                actions={{addCommand: emptyFunction}}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
