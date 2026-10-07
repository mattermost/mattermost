// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {Team} from '@mattermost/types/teams';

import {getAccessControlSettings} from 'mattermost-redux/selectors/entities/access_control';

import CELEditor from 'components/admin_console/access_control/editors/cel_editor/editor';
import {excludeSessionAttributes, hasUsableAttributes, isSimpleExpression, toCELEditorAttributes} from 'components/admin_console/access_control/editors/shared';
import TableEditor, {findFirstAvailableAttributeFromList} from 'components/admin_console/access_control/editors/table_editor/table_editor';
import AdminPanel from 'components/widgets/admin_console/admin_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import type {GlobalState} from 'types/store';

import {teamRuleGuardErrorId} from './team_rule_guards';

import './team_level_access_rules.scss';

interface TeamLevelAccessRulesProps {
    team: Team;
    userAttributes: UserPropertyField[];
    onRulesChange: (hasChanges: boolean, expression: string, autoSync: boolean) => void;
    initialExpression?: string;
    initialAutoSync?: boolean;
    isDisabled?: boolean;
    syncFooter?: React.ReactNode;

    // Keeps the auto-add toggle reachable for a parent-only team (no custom expression).
    hasParentPolicies?: boolean;

    // Server rules carry masked values the admin can't see; CEL mode is then read-only.
    hasMaskedRows?: boolean;
    onValidityChange?: (isValid: boolean) => void;
}

const TeamLevelAccessRules: React.FC<TeamLevelAccessRulesProps> = ({
    team,
    userAttributes,
    onRulesChange,
    initialExpression = '',
    initialAutoSync = false,
    isDisabled = false,
    syncFooter,
    hasParentPolicies = false,
    hasMaskedRows,
    onValidityChange,
}) => {
    const {formatMessage} = useIntl();
    const accessControlSettings = useSelector((state: GlobalState) => getAccessControlSettings(state));

    const [expression, setExpression] = useState(initialExpression);
    const [originalExpression, setOriginalExpression] = useState(initialExpression);

    const [autoSyncMembers, setAutoSyncMembers] = useState(initialAutoSync);
    const [originalAutoSyncMembers, setOriginalAutoSyncMembers] = useState(initialAutoSync);

    const [formError, setFormError] = useState('');

    const [editorMode, setEditorMode] = useState<'table' | 'cel'>('table');
    const [celValid, setCelValid] = useState(true);

    const enableUserManaged = accessControlSettings?.EnableUserManagedAttributes || false;
    const membershipAttributes = useMemo(() => excludeSessionAttributes(userAttributes), [userAttributes]);
    const celAttributes = useMemo(() => toCELEditorAttributes(membershipAttributes, enableUserManaged), [membershipAttributes, enableUserManaged]);
    const noUsableAttributes = membershipAttributes.length > 0 && !hasUsableAttributes(membershipAttributes, enableUserManaged);

    const actions = useChannelAccessControlActions(undefined, team.id);

    const originalValuesInitialized = useRef(false);

    useEffect(() => {
        setExpression(initialExpression);
        setAutoSyncMembers(initialAutoSync);

        if (!originalValuesInitialized.current) {
            setOriginalExpression(initialExpression);
            setOriginalAutoSyncMembers(initialAutoSync);
            originalValuesInitialized.current = true;
        }
    }, [initialExpression, initialAutoSync]);

    // A loaded rule the table can't represent opens in Advanced. Only ever upgrade:
    // initialExpression echoes every edit back from the parent.
    useEffect(() => {
        if (initialExpression && !isSimpleExpression(initialExpression)) {
            setEditorMode('cel');
        }
    }, [initialExpression]);

    // Any membership rule — custom expression or imported parent policy — gates auto-add.
    const hasMembershipRule = expression.trim() !== '' || hasParentPolicies;

    // Derived, not a reset effect: a setState-in-effect here dueled the prop-sync effect
    // through the parent echo and looped on rule removal. Auto-add is meaningless anyway
    // once no rule exists.
    const effectiveAutoSync = hasMembershipRule && autoSyncMembers;

    const hasChanges = useMemo(() => {
        return expression !== originalExpression || effectiveAutoSync !== originalAutoSyncMembers;
    }, [expression, originalExpression, effectiveAutoSync, originalAutoSyncMembers]);

    useEffect(() => {
        onRulesChange(hasChanges, expression, effectiveAutoSync);
    }, [hasChanges, expression, effectiveAutoSync, onRulesChange]);

    const handleExpressionChange = useCallback((newExpression: string) => {
        setExpression(newExpression);
        setFormError('');
    }, []);

    const handleAutoSyncToggle = useCallback(() => {
        if (isDisabled || !hasMembershipRule) {
            return;
        }
        setAutoSyncMembers((prev) => !prev);
    }, [isDisabled, hasMembershipRule]);

    // TableEditor reuses onParseError when it has no attribute to add a row with;
    // only a real parse failure means the rule needs the Advanced editor.
    const handleParseError = useCallback((error: string) => {
        if (!findFirstAvailableAttributeFromList(membershipAttributes, enableUserManaged)) {
            setFormError(error);
            return;
        }
        setEditorMode('cel');
    }, [membershipAttributes, enableUserManaged]);

    const guardError = useMemo(() => {
        switch (teamRuleGuardErrorId(expression)) {
        case 'resource_attributes':
            return formatMessage({id: 'admin.team_settings.team_detail.rules.error.resource_attributes', defaultMessage: 'Team membership rules can\'t reference resource attributes.'});
        case 'session_attributes':
            return formatMessage({id: 'admin.team_settings.team_detail.rules.error.session_attributes', defaultMessage: 'Team membership rules can\'t reference session attributes.'});
        default:
            return '';
        }
    }, [expression, formatMessage]);

    const isValid = (editorMode === 'table' || celValid) && !guardError;
    useEffect(() => {
        onValidityChange?.(isValid);
    }, [isValid, onValidityChange]);
    useEffect(() => () => onValidityChange?.(true), [onValidityChange]);

    const complexInCel = editorMode === 'cel' && !isSimpleExpression(expression);
    const toggleDisabled = isDisabled || noUsableAttributes || complexInCel;
    let toggleTooltip = '';
    if (noUsableAttributes) {
        toggleTooltip = formatMessage({id: 'admin.access_control.policy.edit_policy.no_usable_attributes_tooltip', defaultMessage: 'Please configure user attributes to use the editor.'});
    } else if (complexInCel) {
        toggleTooltip = formatMessage({id: 'admin.access_control.policy.edit_policy.complex_expression_tooltip', defaultMessage: 'Complex expression detected. Simple expressions editor is not available at the moment.'});
    }

    const handleToggleMode = useCallback(() => {
        setEditorMode((mode) => (mode === 'table' ? 'cel' : 'table'));
        setCelValid(true);
        setFormError('');
    }, []);

    // Always wrapped so the button node is stable across disabled/enabled and keeps focus.
    const toggleButton = (
        <WithTooltip
            title={toggleTooltip}
            disabled={!toggleDisabled || !toggleTooltip}
        >
            <Button
                emphasis='primary'
                disabled={toggleDisabled}
                onClick={handleToggleMode}
                data-testid='team-rules-editor-mode-toggle'
            >
                {editorMode === 'table' ? (
                    <FormattedMessage
                        id='admin.access_control.policy.edit_policy.switch_to_advanced'
                        defaultMessage='Switch to Advanced Mode'
                    />
                ) : (
                    <FormattedMessage
                        id='admin.access_control.policy.edit_policy.switch_to_simple'
                        defaultMessage='Switch to Simple Mode'
                    />
                )}
            </Button>
        </WithTooltip>
    );

    const autoSyncDisabled = isDisabled || !hasMembershipRule;

    const renderAutoSyncSection = () => {
        return (
            <>
                <hr className='team-access-rules__divider'/>
                <div className='team-access-rules__auto-sync'>
                    <div className='team-access-rules__auto-sync-checkbox-container'>
                        <input
                            type='checkbox'
                            id='teamAutoAddMembersCheckbox'
                            name='autoAddMembers'
                            className='team-access-rules__auto-sync-checkbox'
                            checked={effectiveAutoSync}
                            onChange={handleAutoSyncToggle}
                            disabled={autoSyncDisabled}
                            data-testid='team-auto-add-members-checkbox'
                        />
                        <label
                            htmlFor='teamAutoAddMembersCheckbox'
                            className='team-access-rules__auto-sync-label'
                        >
                            <span className={`team-access-rules__auto-sync-text${autoSyncDisabled ? ' disabled' : ''}`}>
                                <FormattedMessage
                                    id='team_settings.membership_tab.auto_add'
                                    defaultMessage='Auto-add members based on access rules'
                                />
                            </span>
                        </label>
                    </div>
                    <p className='team-access-rules__auto-sync-description'>
                        {effectiveAutoSync ? (
                            <FormattedMessage
                                id='team_settings.membership_tab.auto_add_enabled_description'
                                defaultMessage='Qualifying users are automatically added as members, and members who no longer match will be removed.'
                            />
                        ) : (
                            <FormattedMessage
                                id='team_settings.membership_tab.auto_add_disabled_description'
                                defaultMessage='Access rules will restrict who can join the team, but qualifying users will not be added automatically.'
                            />
                        )}
                    </p>
                </div>
            </>
        );
    };

    return (
        <>
            <AdminPanel
                id='team_level_access_rules'
                title={defineMessage({
                    id: 'admin.team_settings.team_detail.rules.title',
                    defaultMessage: 'Team-specific membership rules',
                })}
                subtitle={defineMessage({
                    id: 'admin.team_settings.team_detail.rules.subtitle',
                    defaultMessage: 'User attributes and values as additional rules to restrict team membership',
                })}
                className='team-level-access-rules'
                button={toggleButton}
            >
                <div className='team-access-rules__editor'>
                    {editorMode === 'cel' ? (
                        <CELEditor
                            value={expression}
                            onChange={handleExpressionChange}
                            onValidate={setCelValid}
                            disabled={isDisabled || noUsableAttributes}
                            hasMaskedRows={hasMaskedRows}
                            userAttributes={celAttributes}

                            // No teamId (it would scope "Test access rule" to current members) and
                            // no resourceAttributes (team policies reject resource.attributes.*).
                        />
                    ) : (
                        <TableEditor
                            value={expression}
                            onChange={handleExpressionChange}
                            onValidate={() => setFormError('')}
                            userAttributes={membershipAttributes}
                            onParseError={handleParseError}

                            // No teamId: passing it scopes "Test access rule" to current team
                            // members; the test must preview workspace-wide matches like the
                            // policy and channel editors.
                            actions={{
                                getVisualAST: actions.getVisualAST,
                            }}
                            enableUserManagedAttributes={enableUserManaged}
                            disabled={isDisabled}
                        />
                    )}

                    {(guardError || formError) && (
                        <div
                            className='team-access-rules__error'
                            role='alert'
                            aria-live='polite'
                        >
                            <i className='icon icon-alert-outline'/>
                            <span>{guardError || formError}</span>
                        </div>
                    )}
                </div>

                {renderAutoSyncSection()}
                {syncFooter}
            </AdminPanel>
        </>
    );
};

export default TeamLevelAccessRules;
