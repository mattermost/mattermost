// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/access_control';
import {getMembershipRule, buildRulesWithMembership} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';

import {
    createAccessControlTeamSyncJob,
    getTeamAccessControlPolicy,
} from 'mattermost-redux/actions/access_control';
import {getTeamStats} from 'mattermost-redux/actions/teams';
import {getAccessControlSettings} from 'mattermost-redux/selectors/entities/access_control';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import ConfirmModal from 'components/confirm_modal';
import SystemPolicyIndicator from 'components/system_policy_indicator';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import type {GlobalState} from 'types/store';

import './team_membership_tab.scss';

const MAX_USERS_SEARCH_LIMIT = 1000;

type Props = {
    team: Team;
    areThereUnsavedChanges: boolean;
    setAreThereUnsavedChanges: (unsaved: boolean) => void;
    showTabSwitchError?: boolean;
    setShowTabSwitchError: (error: boolean) => void;
};

function TeamMembershipTab({
    team,
    setAreThereUnsavedChanges,
    showTabSwitchError,
    setShowTabSwitchError,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const accessControlSettings = useSelector((state: GlobalState) => getAccessControlSettings(state));
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);

    const [expression, setExpression] = useState('');
    const [originalExpression, setOriginalExpression] = useState('');
    const [existingRules, setExistingRules] = useState<AccessControlPolicyRule[]>([]);
    const [existingImports, setExistingImports] = useState<string[]>([]);
    const [userAttributes, setUserAttributes] = useState<UserPropertyField[]>([]);
    const [attributesLoaded, setAttributesLoaded] = useState(false);

    const [autoAddMembers, setAutoAddMembers] = useState(false);
    const [originalAutoAddMembers, setOriginalAutoAddMembers] = useState(false);

    const [systemPolicies, setSystemPolicies] = useState<AccessControlPolicy[]>([]);
    const [policiesLoaded, setPoliciesLoaded] = useState(false);

    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const [formError, setFormError] = useState('');

    const [showSelfExclusionModal, setShowSelfExclusionModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [allowedCount, setAllowedCount] = useState<number | null>(null);
    const [restrictedCount, setRestrictedCount] = useState<number | null>(null);
    const [isProcessingSave, setIsProcessingSave] = useState(false);

    const saveInProgressRef = useRef(false);

    const actions = useChannelAccessControlActions(undefined, team.id);

    useEffect(() => {
        const loadAttributes = async () => {
            try {
                const result = await actions.getAccessControlFields('', 100);
                if (result.data) {
                    setUserAttributes(result.data);
                }
                setAttributesLoaded(true);
            } catch (error) {
                setUserAttributes([]);
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
                    setAttributesLoaded(true);
                }
            }
        };
        loadAttributes();
    }, [actions]);

    useEffect(() => {
        // Guard against the modal closing (or team changing) mid-fetch: a late
        // response must not write state onto an unmounted/re-keyed component.
        let cancelled = false;
        const loadTeamPolicy = async () => {
            try {
                const result = await dispatch(getTeamAccessControlPolicy(team.id)) as {data?: AccessControlPolicy | null; error?: unknown};
                if (cancelled) {
                    return;
                }
                const policy = result.data;
                if (policy) {
                    const existingExpression = getMembershipRule(policy.rules)?.expression || '';
                    const existingAutoAdd = policy.active || false;
                    const imports = policy.imports || [];

                    setExpression(existingExpression);
                    setOriginalExpression(existingExpression);
                    setExistingRules(policy.rules || []);
                    setExistingImports(imports);
                    setAutoAddMembers(existingAutoAdd);
                    setOriginalAutoAddMembers(existingAutoAdd);

                    if (imports.length > 0) {
                        const fetchedPolicies = await Promise.all(
                            imports.map(async (policyId) => {
                                const pr = await actions.getChannelPolicy(policyId);
                                return pr.data ?? null;
                            }),
                        );
                        if (cancelled) {
                            return;
                        }
                        setSystemPolicies(fetchedPolicies.filter((p): p is AccessControlPolicy => p !== null));
                    }
                }
            } catch {
                if (!cancelled) {
                    setExpression('');
                    setOriginalExpression('');
                }
            } finally {
                if (!cancelled) {
                    setPoliciesLoaded(true);
                }
            }
        };
        loadTeamPolicy();
        return () => {
            cancelled = true;
        };
    }, [team.id, actions, dispatch]);

    useEffect(() => {
        const unsaved = expression !== originalExpression || autoAddMembers !== originalAutoAddMembers;
        setAreThereUnsavedChanges(unsaved);
    }, [expression, originalExpression, autoAddMembers, originalAutoAddMembers, setAreThereUnsavedChanges]);

    const handleExpressionChange = useCallback((newExpression: string) => {
        setExpression(newExpression);
        setSaveChangesPanelState(undefined);
    }, []);

    const handleParseError = useCallback((errorMessage?: string) => {
        if (errorMessage?.includes('403') || errorMessage?.includes('Forbidden')) {
            return;
        }
        setFormError(formatMessage({
            id: 'team_settings.membership_tab.parse_error',
            defaultMessage: 'Invalid expression format',
        }));
    }, [formatMessage]);

    const isEmptyRulesState = useMemo(() => {
        return !expression?.trim() && systemPolicies.length === 0;
    }, [expression, systemPolicies]);

    const handleAutoAddToggle = useCallback(() => {
        if (isEmptyRulesState) {
            return;
        }
        setAutoAddMembers((prev) => !prev);
    }, [isEmptyRulesState]);

    const validateSelfExclusion = useCallback(async (testExpression: string): Promise<boolean> => {
        if (!testExpression.trim()) {
            return true;
        }
        try {
            const result = await actions.validateExpressionAgainstRequester(testExpression);
            if (!result.data?.requester_matches) {
                setShowSelfExclusionModal(true);
                return false;
            }
            return true;
        } catch {
            setFormError(formatMessage({
                id: 'team_settings.membership_tab.error.validation_failed',
                defaultMessage: 'Failed to validate access rules. Please try again.',
            }));
            return false;
        }
    }, [actions, formatMessage]);

    const computeConfirmCounts = useCallback(async (): Promise<{allowed: number | null; restricted: number | null}> => {
        if (!expression.trim()) {
            return {allowed: null, restricted: null};
        }
        try {
            const [searchResult, statsResult] = await Promise.all([
                actions.searchUsers(expression, '', '', MAX_USERS_SEARCH_LIMIT),
                dispatch(getTeamStats(team.id)),
            ]);

            const allowed = searchResult.data?.total ?? null;

            // Use active_member_count, not total_member_count: the allowed count from the
            // expression search excludes deactivated users, so the subtraction must too,
            // or deactivated members would inflate the "do not match" warning.
            const activeMembers = (statsResult?.data as {active_member_count?: number} | null)?.active_member_count ?? null;
            const restricted = allowed !== null && activeMembers !== null ? Math.max(0, activeMembers - allowed) : null;

            return {allowed, restricted};
        } catch {
            return {allowed: null, restricted: null};
        }
    }, [actions, expression, team.id, dispatch]);

    const performSave = useCallback(async (): Promise<boolean> => {
        try {
            setIsProcessingSave(true);

            const policy: AccessControlPolicy = {
                id: team.id,
                name: team.display_name,
                type: 'team',
                active: false,
                rules: buildRulesWithMembership(existingRules, expression),
                imports: existingImports,
            };

            const result = await actions.saveChannelPolicy(policy);
            if (result.error) {
                throw new Error((result.error as Error).message || 'Failed to save policy');
            }

            // The active flag is the auto-add toggle; if it fails to persist the
            // save must not report success, or the UI would show auto-add on while
            // the backend has it off and no sync would run.
            const activeResult = await actions.updateAccessControlPoliciesActive([{id: team.id, active: autoAddMembers}]);
            if (activeResult.error) {
                throw new Error((activeResult.error as Error).message || 'Failed to update auto-add status');
            }

            const rulesChanged = expression !== originalExpression;
            const autoAddTurnedOn = autoAddMembers && !originalAutoAddMembers;

            if (rulesChanged || autoAddTurnedOn) {
                try {
                    await dispatch(createAccessControlTeamSyncJob({policy_id: team.id}));
                } catch {
                    // Non-fatal
                }
            }

            setOriginalExpression(expression);
            setOriginalAutoAddMembers(autoAddMembers);
            setShowConfirmModal(false);
            setAllowedCount(null);
            setRestrictedCount(null);

            return true;
        } catch {
            setFormError(formatMessage({
                id: 'team_settings.membership_tab.save_error',
                defaultMessage: 'Failed to save access rules',
            }));
            return false;
        } finally {
            setIsProcessingSave(false);
        }
    }, [
        team.id,
        team.display_name,
        expression,
        existingRules,
        existingImports,
        autoAddMembers,
        originalExpression,
        originalAutoAddMembers,
        actions,
        dispatch,
        formatMessage,
    ]);

    const handleSave = useCallback(async () => {
        if (expression.trim()) {
            const isValid = await validateSelfExclusion(expression);
            if (!isValid) {
                return;
            }
        }

        const counts = await computeConfirmCounts();
        setAllowedCount(counts.allowed);
        setRestrictedCount(counts.restricted);
        setShowConfirmModal(true);
    }, [expression, validateSelfExclusion, computeConfirmCounts]);

    const handleConfirmSave = useCallback(async () => {
        if (saveInProgressRef.current) {
            return;
        }
        setShowConfirmModal(false);
        saveInProgressRef.current = true;
        try {
            const success = await performSave();
            if (success) {
                setSaveChangesPanelState('saved');
                setShowTabSwitchError(false);
                setAreThereUnsavedChanges(false);
            } else {
                setSaveChangesPanelState('error');
            }
        } finally {
            saveInProgressRef.current = false;
        }
    }, [performSave, setShowTabSwitchError, setAreThereUnsavedChanges]);

    const handleSaveChanges = useCallback(async () => {
        // showConfirmModal guards the window between opening the confirm modal and
        // the user acting on it: the lock below is released as soon as handleSave
        // returns (the modal is still open), so without this a re-trigger would
        // recompute counts and reopen the modal.
        if (saveInProgressRef.current || showConfirmModal) {
            return;
        }
        saveInProgressRef.current = true;
        try {
            await handleSave();
        } finally {
            saveInProgressRef.current = false;
        }
    }, [handleSave, showConfirmModal]);

    const handleCancel = useCallback(() => {
        setExpression(originalExpression);
        setAutoAddMembers(originalAutoAddMembers);
        setFormError('');
        setSaveChangesPanelState(undefined);
    }, [originalExpression, originalAutoAddMembers]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
    }, []);

    const hasErrors = Boolean(formError) || Boolean(showTabSwitchError);

    const shouldShowPanel = useMemo(() => {
        const unsaved = expression !== originalExpression || autoAddMembers !== originalAutoAddMembers;
        return unsaved || saveChangesPanelState === 'saved';
    }, [expression, originalExpression, autoAddMembers, originalAutoAddMembers, saveChangesPanelState]);

    const isEmptyTeamWarning = allowedCount === 0 && !team.allow_open_invite;

    const confirmMessage = (
        <div className='TeamMembershipTab__confirmMessage'>
            {allowedCount !== null && (
                <p>
                    <FormattedMessage
                        id='team_settings.membership_tab.confirm.allowed_count'
                        defaultMessage='{count} {count, plural, one {user matches} other {users match}} the current rules and will have access.'
                        values={{count: allowedCount}}
                    />
                </p>
            )}
            {restrictedCount !== null && restrictedCount > 0 && (
                <p>
                    <FormattedMessage
                        id='team_settings.membership_tab.confirm.restricted_count'
                        defaultMessage='{count} current {count, plural, one {member does} other {members do}} not match the rules and may be affected.'
                        values={{count: restrictedCount}}
                    />
                </p>
            )}
            {isEmptyTeamWarning && (
                <p className='TeamMembershipTab__emptyTeamWarning'>
                    <FormattedMessage
                        id='team_settings.membership_tab.confirm.empty_team_warning'
                        defaultMessage='Warning: No users match these rules. Saving will result in an empty private team.'
                    />
                </p>
            )}
        </div>
    );

    return (
        <div className='TeamMembershipTab'>
            {policiesLoaded && systemPolicies.length > 0 && (
                <div className='TeamMembershipTab__systemPolicies'>
                    <SystemPolicyIndicator
                        policies={systemPolicies}
                        resourceType='team'
                        showPolicyNames={true}
                        variant='detailed'
                    />
                </div>
            )}

            <div className='TeamMembershipTab__header'>
                <h3 className='TeamMembershipTab__title'>
                    {formatMessage({
                        id: 'team_settings.membership_tab.title',
                        defaultMessage: 'Team Membership Rules',
                    })}
                </h3>
                <p className='TeamMembershipTab__subtitle'>
                    {formatMessage({
                        id: 'team_settings.membership_tab.subtitle',
                        defaultMessage: 'Define who can be a member of this team based on user attributes.',
                    })}
                </p>
            </div>

            {attributesLoaded && (
                <div className='TeamMembershipTab__editor'>
                    <TableEditor
                        value={expression}
                        onChange={handleExpressionChange}
                        onValidate={() => setFormError('')}
                        userAttributes={userAttributes}
                        onParseError={handleParseError}
                        teamId={team.id}
                        actions={actions}
                        enableUserManagedAttributes={accessControlSettings?.EnableUserManagedAttributes || false}
                        isSystemAdmin={isSystemAdmin}
                        validateExpressionAgainstRequester={actions.validateExpressionAgainstRequester}
                    />
                </div>
            )}

            <hr className='TeamMembershipTab__divider'/>

            <div className='TeamMembershipTab__autoAddSection'>
                <div className='TeamMembershipTab__autoAddCheckboxContainer'>
                    <input
                        type='checkbox'
                        className='TeamMembershipTab__autoAddCheckbox'
                        checked={autoAddMembers}
                        onChange={handleAutoAddToggle}
                        disabled={isEmptyRulesState}
                        id='autoAddMembersCheckbox'
                        name='autoAddMembers'
                    />
                    <label
                        htmlFor='autoAddMembersCheckbox'
                        className='TeamMembershipTab__autoAddLabel'
                    >
                        <span className={`TeamMembershipTab__autoAddText${isEmptyRulesState ? ' disabled' : ''}`}>
                            {formatMessage({
                                id: 'team_settings.membership_tab.auto_add',
                                defaultMessage: 'Auto-add members based on access rules',
                            })}
                        </span>
                    </label>
                </div>
                <p className='TeamMembershipTab__autoAddDescription'>
                    {autoAddMembers ? formatMessage({
                        id: 'team_settings.membership_tab.auto_add_enabled_description',
                        defaultMessage: 'Qualifying users are automatically added as members, and members who no longer match will be removed.',
                    }) : formatMessage({
                        id: 'team_settings.membership_tab.auto_add_disabled_description',
                        defaultMessage: 'Access rules will restrict who can join the team, but qualifying users will not be added automatically.',
                    })}
                </p>
            </div>

            {shouldShowPanel && (
                <SaveChangesPanel
                    handleSubmit={handleSaveChanges}
                    handleCancel={handleCancel}
                    handleClose={handleClose}
                    tabChangeError={hasErrors}
                    state={hasErrors ? 'error' : saveChangesPanelState}
                    customErrorMessage={formError || undefined}
                    cancelButtonText={formatMessage({
                        id: 'team_settings.membership_tab.reset',
                        defaultMessage: 'Reset',
                    })}
                />
            )}

            <ConfirmModal
                show={showSelfExclusionModal}
                title={
                    <FormattedMessage
                        id='team_settings.membership_tab.error.self_exclusion_title'
                        defaultMessage='Cannot save access rules'
                    />
                }
                message={
                    <FormattedMessage
                        id='team_settings.membership_tab.error.self_exclusion_message'
                        defaultMessage='You cannot set these rules because that will remove you from the team.'
                    />
                }
                confirmButtonText={
                    <FormattedMessage
                        id='team_settings.membership_tab.error.back_to_editing'
                        defaultMessage='Back to editing'
                    />
                }
                onConfirm={() => setShowSelfExclusionModal(false)}
                onCancel={() => setShowSelfExclusionModal(false)}
                hideCancel={true}
                isStacked={true}
            />

            <ConfirmModal
                show={showConfirmModal}
                title={
                    <FormattedMessage
                        id='team_settings.membership_tab.confirm.title'
                        defaultMessage='Save team membership rules?'
                    />
                }
                message={confirmMessage}
                confirmButtonText={
                    isProcessingSave ? (
                        <FormattedMessage
                            id='team_settings.membership_tab.confirm.saving'
                            defaultMessage='Saving...'
                        />
                    ) : (
                        <FormattedMessage
                            id='team_settings.membership_tab.confirm.save'
                            defaultMessage='Save'
                        />
                    )
                }
                cancelButtonText={
                    <FormattedMessage
                        id='team_settings.membership_tab.confirm.cancel'
                        defaultMessage='Cancel'
                    />
                }
                onConfirm={handleConfirmSave}
                onCancel={() => {
                    setShowConfirmModal(false);
                    setAllowedCount(null);
                    setRestrictedCount(null);
                }}
                isStacked={true}
            />
        </div>
    );
}

export default TeamMembershipTab;
