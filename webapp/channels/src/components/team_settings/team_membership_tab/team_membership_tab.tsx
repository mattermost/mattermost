// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/access_control';
import {getMembershipRule, buildRulesWithMembership} from '@mattermost/types/access_control';
import type {JobType} from '@mattermost/types/jobs';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {Team} from '@mattermost/types/teams';

import {
    createAccessControlTeamSyncJob,
    getTeamAccessControlPolicy,
} from 'mattermost-redux/actions/access_control';
import {getJobsByType} from 'mattermost-redux/actions/jobs';
import {getTeamStats} from 'mattermost-redux/actions/teams';
import {getAccessControlSettings} from 'mattermost-redux/selectors/entities/access_control';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import ConfirmModal from 'components/confirm_modal';
import SystemPolicyIndicator from 'components/system_policy_indicator';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import type {GlobalState} from 'types/store';

import 'components/team_settings/team_access_policies_tab/sync_status_footer.scss';
import './team_membership_tab.scss';

const MAX_USERS_SEARCH_LIMIT = 1000;
const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function getSyncTimeText(timestamp: number, formatMessage: ReturnType<typeof useIntl>['formatMessage']): string {
    if (!timestamp) {
        return formatMessage({id: 'team_settings.sync_status.never', defaultMessage: 'Never synced.'});
    }
    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.floor(diffMs / MS_PER_MINUTE);
    if (diffMinutes < 1) {
        return formatMessage({id: 'team_settings.sync_status.just_now', defaultMessage: 'Last synced just now.'});
    }
    if (diffMinutes < MINUTES_PER_HOUR) {
        return formatMessage(
            {id: 'team_settings.sync_status.minutes_ago', defaultMessage: 'Last synced {count} {count, plural, one {minute} other {minutes}} ago.'},
            {count: diffMinutes},
        );
    }
    const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
    if (diffHours < HOURS_PER_DAY) {
        return formatMessage(
            {id: 'team_settings.sync_status.hours_ago', defaultMessage: 'Last synced {count} {count, plural, one {hour} other {hours}} ago.'},
            {count: diffHours},
        );
    }
    const diffDays = Math.floor(diffHours / HOURS_PER_DAY);
    return formatMessage(
        {id: 'team_settings.sync_status.days_ago', defaultMessage: 'Last synced {count} {count, plural, one {day} other {days}} ago.'},
        {count: diffDays},
    );
}

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

    const [lastSyncedAt, setLastSyncedAt] = useState<number>(0);
    const [syncing, setSyncing] = useState(false);
    const [syncLoaded, setSyncLoaded] = useState(false);

    const saveInProgressRef = useRef(false);

    const actions = useChannelAccessControlActions(undefined, team.id);

    const hasPolicy = policiesLoaded && (originalExpression !== '' || existingImports.length > 0 || systemPolicies.length > 0);

    const fetchSyncStatus = useCallback(async () => {
        try {
            const result = await dispatch(getJobsByType('access_control_team_sync' as JobType, 0, 10, undefined, team.id));
            if (result.data) {
                const completedJob = (result.data as Array<{status: string; last_activity_at: number}>).find((job) => job.status === 'success');
                if (completedJob) {
                    setLastSyncedAt(completedJob.last_activity_at);
                }
            }
        } catch {
            // Non-fatal
        }
        setSyncLoaded(true);
    }, [dispatch, team.id]);

    useEffect(() => {
        if (hasPolicy) {
            fetchSyncStatus();
        }
    }, [hasPolicy, fetchSyncStatus]);

    const handleSyncNow = useCallback(async () => {
        setSyncing(true);
        try {
            const result = await dispatch(createAccessControlTeamSyncJob({policy_id: team.id}));
            if (result.error) {
                setSyncing(false);
            }
        } catch {
            setSyncing(false);
        }
    }, [dispatch, team.id]);

    useEffect(() => {
        if (!syncing) {
            return undefined;
        }
        const interval = setInterval(async () => {
            const result = await dispatch(getJobsByType('access_control_team_sync' as JobType, 0, 10, undefined, team.id));
            if (result.error) {
                setSyncing(false);
                return;
            }
            if (result.data) {
                const completedJob = (result.data as Array<{status: string; last_activity_at: number}>).find((job) => job.status === 'success');
                if (completedJob && completedJob.last_activity_at > lastSyncedAt) {
                    setLastSyncedAt(completedJob.last_activity_at);
                    setSyncing(false);
                }
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [syncing, dispatch, team.id, lastSyncedAt]);

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
                const result = await dispatch(getTeamAccessControlPolicy(team.id)) as {data?: {policy: AccessControlPolicy | null; enforced: boolean} | null; error?: unknown};
                if (cancelled) {
                    return;
                }
                const policy = result.data?.policy ?? null;
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

    // The sync enforces the team's own membership rule ANDed with the expressions of
    // any imported system/parent policies (see the server's ResolveRule/MergeExpressions).
    // The confirm count must simulate that SAME combined expression, otherwise it
    // misreports who is affected whenever a system policy is applied to the team.
    const buildEffectiveExpression = useCallback((): string => {
        const parts: string[] = [];
        if (expression.trim()) {
            parts.push(expression.trim());
        }
        for (const policy of systemPolicies) {
            const systemExpr = getMembershipRule(policy.rules)?.expression;
            if (systemExpr && systemExpr.trim()) {
                parts.push(systemExpr.trim());
            }
        }
        if (parts.length === 0) {
            return '';
        }
        if (parts.length === 1) {
            return parts[0]!;
        }
        return parts.map((part) => `(${part})`).join(' && ');
    }, [expression, systemPolicies]);

    const computeConfirmCounts = useCallback(async (): Promise<{allowed: number | null; restricted: number | null}> => {
        const effectiveExpression = buildEffectiveExpression();
        if (!effectiveExpression.trim()) {
            return {allowed: null, restricted: null};
        }
        try {
            const [searchResult, statsResult] = await Promise.all([
                actions.searchUsers(effectiveExpression, '', '', MAX_USERS_SEARCH_LIMIT),
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
    }, [actions, buildEffectiveExpression, team.id, dispatch]);

    const performSave = useCallback(async (): Promise<boolean> => {
        try {
            setIsProcessingSave(true);

            const builtRules = buildRulesWithMembership(existingRules, expression);
            const isEmptyPolicy = builtRules.length === 0 && existingImports.length === 0;

            if (isEmptyPolicy) {
                // Clearing all rules — delete the policy if one existed, otherwise nothing to do.
                const hadExistingPolicy = originalExpression !== '' || existingRules.length > 0;
                if (hadExistingPolicy) {
                    const deleteResult = await actions.deleteChannelPolicy(team.id);
                    if (deleteResult.error) {
                        throw new Error((deleteResult.error as Error).message || 'Failed to delete policy');
                    }
                }
                setOriginalExpression('');
                setOriginalAutoAddMembers(false);
                setAutoAddMembers(false);
                setExistingRules([]);
                setExistingImports([]);
                setShowConfirmModal(false);
                setAllowedCount(null);
                setRestrictedCount(null);
                return true;
            }

            const policy: AccessControlPolicy = {
                id: team.id,
                name: team.display_name,
                type: 'team',
                active: false,
                rules: builtRules,
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

            // Kick an immediate reconcile so membership changes apply on save rather
            // than waiting for the hourly scheduler. The sync worker decides removal
            // vs. add by team privacy and the policy's active flag: on a strict
            // (private) team the removal pass runs regardless of auto-add, so a rule
            // change MUST trigger a job even with auto-add off — otherwise
            // non-qualifying members linger until the periodic scheduler runs. On
            // advisory (public) teams the worker no-ops, so an extra job is harmless.
            if (rulesChanged || autoAddTurnedOn) {
                try {
                    await dispatch(createAccessControlTeamSyncJob({policy_id: team.id}));
                } catch {
                    // Non-fatal: the periodic scheduler reconciles on its next run.
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

            {hasPolicy && syncLoaded && (
                <div className='SyncStatusFooter'>
                    <i className='icon icon-information-outline SyncStatusFooter__icon'/>
                    <span className='SyncStatusFooter__text'>
                        {getSyncTimeText(lastSyncedAt, formatMessage)}
                    </span>
                    {syncing ? (
                        <>
                            <span className='SyncStatusFooter__syncing'>
                                {formatMessage({id: 'team_settings.sync_status.syncing', defaultMessage: 'Syncing...'})}
                            </span>
                            <LoadingSpinner/>
                        </>
                    ) : (
                        <button
                            className='style--none SyncStatusFooter__link'
                            onClick={handleSyncNow}
                        >
                            {formatMessage({id: 'team_settings.sync_status.sync_now', defaultMessage: 'Sync now'})}
                        </button>
                    )}
                </div>
            )}

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
