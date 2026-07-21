// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {Team} from '@mattermost/types/teams';

import {getAccessControlSettings} from 'mattermost-redux/selectors/entities/access_control';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import AdminPanelWithButton from 'components/widgets/admin_console/admin_panel_with_button';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import type {GlobalState} from 'types/store';

import './team_level_access_rules.scss';

interface TeamLevelAccessRulesProps {
    team: Team;
    userAttributes: UserPropertyField[];
    onRulesChange: (hasChanges: boolean, expression: string, autoSync: boolean) => void;
    initialExpression?: string;
    initialAutoSync?: boolean;
    isDisabled?: boolean;
    syncFooter?: React.ReactNode;
}

const TeamLevelAccessRules: React.FC<TeamLevelAccessRulesProps> = ({
    team,
    userAttributes,
    onRulesChange,
    initialExpression = '',
    initialAutoSync = false,
    isDisabled = false,
    syncFooter,
}) => {
    const accessControlSettings = useSelector((state: GlobalState) => getAccessControlSettings(state));

    const [expression, setExpression] = useState(initialExpression);
    const [originalExpression, setOriginalExpression] = useState(initialExpression);

    const [autoSyncMembers, setAutoSyncMembers] = useState(initialAutoSync);
    const [originalAutoSyncMembers, setOriginalAutoSyncMembers] = useState(initialAutoSync);

    const [formError, setFormError] = useState('');

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

    const hasChanges = useMemo(() => {
        return expression !== originalExpression || autoSyncMembers !== originalAutoSyncMembers;
    }, [expression, originalExpression, autoSyncMembers, originalAutoSyncMembers]);

    useEffect(() => {
        onRulesChange(hasChanges, expression, autoSyncMembers);
    }, [hasChanges, expression, autoSyncMembers, onRulesChange]);

    useEffect(() => {
        if (!expression.trim()) {
            setAutoSyncMembers(false);
        }
    }, [expression]);

    const handleExpressionChange = useCallback((newExpression: string) => {
        setExpression(newExpression);
        setFormError('');
    }, []);

    const handleAutoSyncToggle = useCallback(() => {
        if (isDisabled || !expression.trim()) {
            return;
        }
        setAutoSyncMembers((prev) => !prev);
    }, [isDisabled, expression]);

    const handleParseError = useCallback((error: string) => {
        setFormError(error);
    }, []);

    const autoSyncDisabled = isDisabled || !expression.trim();

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
                            checked={autoSyncMembers}
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
                        {autoSyncMembers ? (
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
            <AdminPanelWithButton
                id='team_level_access_rules'
                title={defineMessage({
                    id: 'admin.team_settings.team_detail.rules.title',
                    defaultMessage: 'Custom access rules',
                })}
                subtitle={defineMessage({
                    id: 'admin.team_settings.team_detail.rules.subtitle',
                    defaultMessage: 'User attributes and values as additional rules to restrict team membership',
                })}
                className='team-level-access-rules'
            >
                <div className='team-access-rules__editor'>
                    <TableEditor
                        value={expression}
                        onChange={handleExpressionChange}
                        onValidate={() => setFormError('')}
                        userAttributes={userAttributes}
                        onParseError={handleParseError}
                        teamId={team.id}
                        actions={{
                            getVisualAST: actions.getVisualAST,
                        }}
                        enableUserManagedAttributes={accessControlSettings?.EnableUserManagedAttributes || false}
                        disabled={isDisabled}
                    />

                    {formError && (
                        <div className='team-access-rules__error'>
                            <i className='icon icon-alert-outline'/>
                            <span>{formError}</span>
                        </div>
                    )}
                </div>

                {renderAutoSyncSection()}
                {syncFooter}
            </AdminPanelWithButton>
        </>
    );
};

export default TeamLevelAccessRules;
