// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import RuleEditorCard from './rule_editor_card';

import CELEditor from '../../access_control/editors/cel_editor/editor';
import TableEditor from '../../access_control/editors/table_editor/table_editor';

jest.mock('../../access_control/editors/table_editor/table_editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'table-editor'}));
});

jest.mock('../../access_control/editors/cel_editor/editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'cel-editor'}));
});

const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;
const MockedCELEditor = CELEditor as jest.MockedFunction<typeof CELEditor>;

type Props = ComponentProps<typeof RuleEditorCard>;

const E = 'user.attributes.teams == "engineering"';
const COMPLEX = 'user.attributes.a == "x" || user.attributes.b == "y"';
const APOSTROPHE = 'user.attributes.department == "Matt\'s Department"';
const HAS_ANY_OF = '"a" in user.attributes.teams || "b" in user.attributes.teams';
const LEGACY_TOOLTIP = 'Testing the rule alone isn\'t available for bot account policies.';
const SCOPES_AND_MODES: Array<[Props['scope'], Props['editorMode']]> = [['user', 'table'], ['user', 'cel'], ['bot', 'table'], ['bot', 'cel']];
const MODES: Array<Props['editorMode']> = ['table', 'cel'];

const field = (id: string, name: string, attrs: Partial<UserPropertyField['attrs']>, objectType = 'user'): UserPropertyField => ({
    id,
    name,
    type: 'text',
    group_id: 'custom_profile_attributes',
    target_id: '',
    target_type: 'system',
    object_type: objectType,
    attrs: {sort_order: 0, visibility: 'always', value_type: '', ...attrs},
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
} as UserPropertyField);
const NATIVE_FIELDS = ['email', 'verified', 'isbot', 'createat'].map((name) => field(`native_user_attribute_${name}`, name, {native: true}));
const CPA_EMAIL = field('cpa-email', 'email', {managed: 'admin'});
const LDAP_TEAMS = field('u-teams', 'teams', {ldap: 'memberOf'});
const SESSION_NETWORK = field('s1', 'network_name', {enabled: true}, 'session');

describe('components/admin_console/permission_policies/policy_details/RuleEditorCard', () => {
    const baseProps: Props = {
        scope: 'user',
        expression: E,
        editorMode: 'table',
        onExpressionChange: jest.fn(),
        onEditorModeChange: jest.fn(),
        disabled: false,
        noUsableAttributes: false,
        userFields: [],
        sessionFields: [],
        resourceFields: [],
        mergedAttributes: [],
        enableUserManagedAttributes: false,
        abacActions: {getVisualAST: jest.fn()},
    };

    const renderCard = (props: Partial<Props> = {}) => renderWithContext(
        <RuleEditorCard
            {...baseProps}
            {...props}
        />,
    );
    const lastTableProps = () => MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
    const lastCELProps = () => MockedCELEditor.mock.calls[MockedCELEditor.mock.calls.length - 1][0];
    const lastEditorProps = (mode: Props['editorMode']) => (mode === 'table' ? lastTableProps() : lastCELProps());
    const toggle = (label: string) => screen.getByText(label).closest('button')!;

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('mode toggle', () => {
        test('table mode offers Advanced mode and switches to CEL', async () => {
            renderCard();

            await userEvent.click(toggle('Switch to Advanced Mode'));

            expect(baseProps.onEditorModeChange).toHaveBeenCalledWith('cel');
        });

        test('CEL mode with a simple expression offers Simple mode and switches to table', async () => {
            renderCard({editorMode: 'cel'});

            await userEvent.click(toggle('Switch to Simple Mode'));

            expect(baseProps.onEditorModeChange).toHaveBeenCalledWith('table');
        });

        test('is disabled with an explanation for a complex expression in CEL mode', async () => {
            renderCard({editorMode: 'cel', expression: COMPLEX});

            const button = toggle('Switch to Simple Mode');
            expect(button).toBeDisabled();
            fireEvent.mouseEnter(button);
            expect(await screen.findByRole('tooltip', {}, {timeout: 2000})).toHaveTextContent('Complex expression detected. Simple expressions editor is not available at the moment.');
        });

        test('is disabled with an explanation when no attributes are usable', async () => {
            renderCard({noUsableAttributes: true});

            const button = toggle('Switch to Advanced Mode');
            expect(button).toBeDisabled();
            fireEvent.mouseEnter(button);
            expect(await screen.findByRole('tooltip', {}, {timeout: 2000})).toHaveTextContent('Please configure user attributes to use the editor.');
        });

        // MM-64357
        test.each([
            ['an apostrophe value', APOSTROPHE],
            ['a has-any-of group without parens', HAS_ANY_OF],
        ])('stays enabled in CEL mode for %s', (_label, expression) => {
            renderCard({editorMode: 'cel', expression});

            expect(toggle('Switch to Simple Mode')).toBeEnabled();
        });
    });

    describe('editor', () => {
        test.each(MODES)('%s mode renders only that editor', (editorMode) => {
            renderCard({editorMode});

            expect(screen.getByTestId(`${editorMode}-editor`)).toBeInTheDocument();
            expect(screen.queryByTestId(`${editorMode === 'table' ? 'cel' : 'table'}-editor`)).not.toBeInTheDocument();
        });

        test.each(MODES)('%s mode forwards edits', (editorMode) => {
            renderCard({editorMode});

            lastEditorProps(editorMode).onChange('user.attributes.teams == "x"');

            expect(baseProps.onExpressionChange).toHaveBeenCalledWith('user.attributes.teams == "x"');
        });

        test('a table parse error falls back to CEL mode', () => {
            renderCard();

            lastTableProps().onParseError('bad');

            expect(baseProps.onEditorModeChange).toHaveBeenCalledWith('cel');
        });

        test.each([
            ['while saving', {disabled: true}],
            ['without usable attributes', {noUsableAttributes: true}],
        ] as Array<[string, Partial<Props>]>)('disables both editors %s', (_label, props) => {
            const {unmount} = renderCard(props);
            expect(lastTableProps().disabled).toBe(true);
            unmount();

            renderCard({...props, editorMode: 'cel'});
            expect(lastCELProps().disabled).toBe(true);
        });

        test('passes the table editor its attributes and actions', () => {
            const mergedAttributes = [{id: 'f1', name: 'teams'} as UserPropertyField];
            renderCard({mergedAttributes, enableUserManagedAttributes: true});

            expect(lastTableProps().userAttributes).toBe(mergedAttributes);
            expect(lastTableProps().enableUserManagedAttributes).toBe(true);
            expect(lastTableProps().actions).toBe(baseProps.abacActions);
        });

        test('passes the CEL editor its user, session and channel attributes', () => {
            renderCard({editorMode: 'cel', userFields: [LDAP_TEAMS], sessionFields: [SESSION_NETWORK], resourceFields: [{id: 'c1', name: 'minClearance'} as UserPropertyField]});

            expect(lastCELProps().userAttributes).toEqual([
                {attribute: 'teams', values: [], isNative: false, objectType: 'user'},
                {attribute: 'network_name', values: [], isNative: false, objectType: 'session'},
            ]);
            expect(lastCELProps().resourceAttributes).toEqual([{attribute: 'minClearance'}]);
        });

        test('drops user-managed attributes from CEL autocomplete unless enabled', () => {
            const unmanaged = field('u-free', 'nickname', {});
            const {unmount} = renderCard({editorMode: 'cel', userFields: [unmanaged]});
            expect(lastCELProps().userAttributes).toEqual([]);
            unmount();

            renderCard({editorMode: 'cel', userFields: [unmanaged], enableUserManagedAttributes: true});
            expect(lastCELProps().userAttributes.map((a) => a.attribute)).toEqual(['nickname']);
        });
    });

    describe('copy per scope', () => {
        test.each([
            ['user', 'User attribute requirements', 'Select attributes and values that users must have for this policy', 'Bot attribute requirements'],
            ['bot', 'Bot attribute requirements', 'Select attributes and values that bots must have for this policy', 'User attribute requirements'],
        ] as Array<[Props['scope'], string, string, string]>)('%s scope shows its title and subtitle', (scope, title, subtitle, otherTitle) => {
            renderCard({scope});

            expect(screen.getByText(title)).toBeInTheDocument();
            expect(screen.getByText(subtitle)).toBeInTheDocument();
            expect(screen.queryByText(otherTitle)).not.toBeInTheDocument();
        });

        test('bot scope gives the table editor bot help and empty-state text', () => {
            renderCard({scope: 'bot'});

            expect(lastTableProps().helpText).toBe('Each row is a single condition that must be met for a bot to comply with the policy. All rules are combined with logical AND operator (`&&`).');
            expect(lastTableProps().emptyStateText).toBe('Select a bot attribute and values to create a rule');
        });

        test('user scope leaves the table editor on its default help and empty-state text', () => {
            renderCard();

            expect(lastTableProps().helpText).toBeUndefined();
            expect(lastTableProps().emptyStateText).toBeUndefined();
        });
    });

    describe('hidden built-ins', () => {
        test('Bot accounts hides email, verified and isbot from the table picker', () => {
            renderCard({scope: 'bot'});

            expect(lastTableProps().hiddenPickerAttributeNames).toEqual(['email', 'verified', 'isbot']);
        });

        test('Members hides nothing', () => {
            renderCard();

            expect(lastTableProps().hiddenPickerAttributeNames).toBeUndefined();
        });

        test('Bot accounts drops the native built-ins from CEL autocomplete but keeps a custom email', () => {
            renderCard({scope: 'bot', editorMode: 'cel', userFields: [...NATIVE_FIELDS, CPA_EMAIL]});

            expect(lastCELProps().userAttributes.map((a) => [a.attribute, a.isNative])).toEqual([['createat', true], ['email', false]]);
        });

        test('Members keeps every built-in in CEL autocomplete', () => {
            renderCard({editorMode: 'cel', userFields: NATIVE_FIELDS});

            expect(lastCELProps().userAttributes.map((a) => a.attribute)).toEqual(['email', 'verified', 'isbot', 'createat']);
        });

        // TableEditor's picker memo is keyed on this array's reference.
        test('keeps one array reference across scope switches and edits', () => {
            const {rerender} = renderCard({scope: 'bot'});
            rerender(<RuleEditorCard {...baseProps}/>);
            expect(lastTableProps().hiddenPickerAttributeNames).toBeUndefined();
            rerender(
                <RuleEditorCard
                    {...baseProps}
                    scope='bot'
                    expression='user.attributes.teams == "other"'
                />,
            );

            const refs = new Set(MockedTableEditor.mock.calls.map(([p]) => p.hiddenPickerAttributeNames).filter(Boolean));
            expect(refs.size).toBe(1);
        });
    });

    describe('test button', () => {
        test.each(MODES)('Bot accounts without the simulator disables it with an explanation (%s)', (editorMode) => {
            renderCard({scope: 'bot', editorMode});

            const props = lastEditorProps(editorMode);
            expect(props.onTestClick).toBeUndefined();
            expect(props.testButtonDisabled).toBe(true);
            expect(props.testButtonTooltip).toBe(LEGACY_TOOLTIP);
            expect(props.testButtonLabel).toBeUndefined();
        });

        test.each(MODES)('Members without the simulator keeps the default test (%s)', (editorMode) => {
            renderCard({editorMode});

            const props = lastEditorProps(editorMode);
            expect(props.onTestClick).toBeUndefined();
            expect(props.testButtonDisabled).toBe(false);
            expect(props.testButtonTooltip).toBeUndefined();
            expect(props.testButtonLabel).toBeUndefined();
        });

        test.each(SCOPES_AND_MODES)('%s scope with the simulator becomes Simulate rules (%s)', (scope, editorMode) => {
            const onTestClick = jest.fn();
            renderCard({scope, editorMode, onTestClick});

            const props = lastEditorProps(editorMode);
            expect(props.onTestClick).toBe(onTestClick);
            expect(props.testButtonDisabled).toBe(false);
            expect(props.testButtonTooltip).toBeUndefined();
            renderWithContext(<>{props.testButtonLabel}</>);
            expect(screen.getByText('Simulate rules')).toBeInTheDocument();
        });
    });
});
