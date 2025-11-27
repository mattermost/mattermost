// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {describe, it, expect, vi} from 'vitest';

import Action from './action';

describe('components/drafts/draft_actions/action', () => {
    const baseProps = {
        icon: 'some-icon',
        id: 'some-id',
        name: 'some-name',
        onClick: vi.fn(),
        tooltipText: 'some-tooltip-text',
    };

    it('should match snapshot', () => {
        const {container} = render(
            <Action
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
