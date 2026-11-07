// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {ReactTestRendererJSON} from 'react-test-renderer';

import {emptyChecklistItem} from 'src/types/playbook';

import ConditionIndicator from './condition_indicator';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/components/widgets/tooltip', () => ({
    __esModule: true,
    default: ({children, content}: any) => (
        <div data-tooltip={content}>{children}</div>
    ),
}));

jest.mock('@mattermost/compass-icons/components', () => ({
    SourceBranchIcon: ({size, color}: any) => (
        <svg
            data-size={size}
            data-color={color}
        />
    ),
}));

describe('ConditionIndicator', () => {
    it('should return null when no condition_id', () => {
        const item = emptyChecklistItem();
        const component = renderer.create(
            <ConditionIndicator
                checklistItem={item}
                tooltipMessage=''
            />,
        );
        expect(component.toJSON()).toBeNull();
    });

    it('should render gray icon for normal condition', () => {
        const item = {
            ...emptyChecklistItem(),
            id: 'test-123',
            condition_id: 'cond-456',
            condition_action: '',
            condition_reason: '"Priority" is "High"',
        };
        const component = renderer.create(
            <ConditionIndicator
                checklistItem={item}
                tooltipMessage='Shown because "Priority" is "High"'
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        expect(Array.isArray(tree)).toBe(false);
        if (tree && !Array.isArray(tree) && tree.children) {
            expect(tree.props['data-tooltip']).toBe('Shown because "Priority" is "High"');
            const child = tree.children[0] as ReactTestRendererJSON;
            if (child.children) {
                const grandchild = child.children[0] as ReactTestRendererJSON;
                expect(grandchild.props['data-color']).toBe('rgba(var(--center-channel-color-rgb), 0.56)');
                expect(grandchild.props['data-size']).toBe(14);
            }
        }
    });

    it('should render red icon for shown_because_modified', () => {
        const item = {
            ...emptyChecklistItem(),
            id: 'test-789',
            condition_id: 'cond-012',
            condition_action: 'shown_because_modified',
            condition_reason: 'shown because the task was modified',
        };
        const component = renderer.create(
            <ConditionIndicator
                checklistItem={item}
                tooltipMessage='Condition no longer met, but task shown because it was modified'
            />,
        );
        const tree = component.toJSON();

        expect(tree).toBeTruthy();
        expect(Array.isArray(tree)).toBe(false);
        if (tree && !Array.isArray(tree) && tree.children) {
            expect(tree.props['data-tooltip']).toBe('Condition no longer met, but task shown because it was modified');
            const child = tree.children[0] as ReactTestRendererJSON;
            if (child.children) {
                const grandchild = child.children[0] as ReactTestRendererJSON;
                expect(grandchild.props['data-color']).toBe('var(--error-text)');
                expect(grandchild.props['data-size']).toBe(14);
            }
        }
    });
});
