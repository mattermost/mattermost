// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, useRef} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import {combineMembershipExpressions, getMembershipRule} from '@mattermost/types/access_control';

import ConfirmModal from 'components/confirm_modal';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import AllowedDomainsSelect from './allowed_domains_select';
import InviteSectionInput from './invite_section_input';
import OpenInvite from './open_invite';

import type {PropsFromRedux, OwnProps} from '.';

import './team_access_tab.scss';

const generateAllowedDomainOptions = (allowedDomains?: string) => {
    if (!allowedDomains || allowedDomains.length === 0) {
        return [];
    }
    const domainList = allowedDomains.includes(',') ? allowedDomains.split(',') : [allowedDomains];
    return domainList.map((domain) => domain.trim());
};

type Props = PropsFromRedux & OwnProps;

const AccessTab = ({showTabSwitchError, areThereUnsavedChanges, setShowTabSwitchError, setAreThereUnsavedChanges, team, teamMembershipAccessControlEnabled, actions}: Props) => {
    const [allowedDomains, setAllowedDomains] = useState<string[]>(() => generateAllowedDomainOptions(team.allowed_domains));
    const isPublicTeamInitial = team.allow_open_invite ?? false;

    // ABAC governs this team only when the feature is enabled (license + flag +
    // config) and a policy is attached. A stale policy row on a disabled instance
    // must stay on the legacy path.
    const teamAbacActive = Boolean(teamMembershipAccessControlEnabled && team.policy_enforced);
    const [isPublicTeam, setIsPublicTeam] = useState<boolean>(isPublicTeamInitial);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const [isSaving, setIsSaving] = useState(false);

    // Mode-flip confirmation modal state
    const [showModeFlipModal, setShowModeFlipModal] = useState(false);
    const [modeFlipMemberCount, setModeFlipMemberCount] = useState<number | null>(null);
    const [showSelfExclusionModal, setShowSelfExclusionModal] = useState(false);
    const pendingPublicValueRef = useRef<boolean | null>(null);

    const handleAllowedDomainsSubmit = useCallback(async (): Promise<boolean> => {
        const {error} = await actions.patchTeam({
            id: team.id,
            allowed_domains: allowedDomains.length === 1 ? allowedDomains[0] : allowedDomains.join(', '),
        });
        if (error) {
            return false;
        }
        return true;
    }, [actions, allowedDomains, team]);

    const handlePrivacySubmit = useCallback(async (): Promise<boolean> => {
        if (isPublicTeam === isPublicTeamInitial) {
            return true;
        }

        // Privacy follows master's model on every path: patch allow_open_invite
        // only, leaving team.type untouched. ABAC join/sync/directory logic keys on
        // allow_open_invite alone, so there is nothing to normalize.
        const {error} = await actions.patchTeam({id: team.id, allow_open_invite: isPublicTeam});
        return !error;
    }, [actions, isPublicTeam, isPublicTeamInitial, team]);

    // The expression the sync will enforce once private: the team's own membership
    // rule ANDed with any imported parent policies. Returns null when there is no
    // rule (or an import can't be resolved) so callers fall back to generic handling.
    const getCombinedTeamExpression = useCallback(async (): Promise<string | null> => {
        const policyResult = await actions.getTeamAccessControlPolicy(team.id);
        const policyData = policyResult?.data as {policy: AccessControlPolicy | null; enforced: boolean} | undefined;
        const teamExpression = getMembershipRule(policyData?.policy?.rules)?.expression;

        // Parent-governed teams keep the rules in the imported policy, not here.
        const parentIds = policyData?.policy?.imports ?? [];
        const parentPolicies = await Promise.all(
            parentIds.map((id) => actions.getAccessControlPolicy(id)),
        );

        // A dropped import would understate the rule set; treat as unresolved.
        if (parentPolicies.some((result) => result?.error || !result?.data)) {
            return null;
        }
        const parentExpressions = parentPolicies.map((result) =>
            getMembershipRule((result.data as AccessControlPolicy).rules)?.expression,
        );

        return combineMembershipExpressions([teamExpression, ...parentExpressions]) || null;
    }, [actions, team.id]);

    const computeModeFlipCount = useCallback(async (expression: string | null): Promise<number | null> => {
        if (!expression) {
            return null;
        }
        try {
            // active - matching, server-side to avoid paging the member list.
            const [searchResult, statsResult] = await Promise.all([
                actions.searchUsersForExpression(expression, '', '', 1, undefined, team.id),
                actions.getTeamStats(team.id),
            ]);

            const allowed = searchResult?.data?.total ?? null;
            const activeMembers = (statsResult?.data as {active_member_count?: number} | null)?.active_member_count ?? null;

            if (allowed === null || activeMembers === null) {
                return null;
            }

            return Math.max(0, activeMembers - allowed);
        } catch {
            return null;
        }
    }, [actions, team.id]);

    const handlePrivacyChange = useCallback(async (newIsPublic: boolean) => {
        setAreThereUnsavedChanges(true);
        setSaveChangesPanelState('editing');

        if (!newIsPublic && isPublicTeam && teamAbacActive) {
            pendingPublicValueRef.current = newIsPublic;

            let expression: string | null = null;
            try {
                expression = await getCombinedTeamExpression();
            } catch {
                expression = null;
            }

            // Switching to private activates strict enforcement, which would remove
            // the editing admin if they don't meet the rules. Block the switch (only
            // when we can confirm the mismatch) so they don't lock themselves out.
            if (expression) {
                const result = await actions.validateExpressionAgainstRequester(expression, undefined, team.id);
                if (result.data && !result.data.requester_matches) {
                    pendingPublicValueRef.current = null;
                    setAreThereUnsavedChanges(false);
                    setSaveChangesPanelState(undefined);
                    setShowSelfExclusionModal(true);
                    return;
                }
            }

            const count = await computeModeFlipCount(expression);
            setModeFlipMemberCount(count);
            setShowModeFlipModal(true);
            return;
        }

        setIsPublicTeam(newIsPublic);
    }, [isPublicTeam, teamAbacActive, getCombinedTeamExpression, computeModeFlipCount, actions, team.id, setAreThereUnsavedChanges]);

    const handleModeFlipConfirm = useCallback(async () => {
        setShowModeFlipModal(false);
        if (pendingPublicValueRef.current !== null) {
            setIsPublicTeam(pendingPublicValueRef.current);
            pendingPublicValueRef.current = null;
        }

        if (teamAbacActive) {
            try {
                await actions.createAccessControlTeamSyncJob({policy_id: team.id});
            } catch (jobError) {
                // Job creation failure does not block the privacy change; the
                // periodic sync still converges membership. Log so an operator
                // can see why immediate enforcement did not kick in.
                // eslint-disable-next-line no-console
                console.error('Failed to create team access control sync job after mode flip:', jobError);
            }
        }
    }, [actions, team.id, teamAbacActive]);

    const handleModeFlipCancel = useCallback(() => {
        setShowModeFlipModal(false);
        pendingPublicValueRef.current = null;
    }, []);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState('editing');
        setAreThereUnsavedChanges(false);
        setShowTabSwitchError(false);
    }, [setShowTabSwitchError, setAreThereUnsavedChanges]);

    const handleCancel = useCallback(() => {
        setAllowedDomains(generateAllowedDomainOptions(team.allowed_domains));
        setIsPublicTeam(isPublicTeamInitial);
        handleClose();
    }, [handleClose, isPublicTeamInitial, team.allowed_domains]);

    const handleSaveChanges = useCallback(async () => {
        if (isSaving) {
            return;
        }
        setIsSaving(true);
        const allowedDomainSuccess = await handleAllowedDomainsSubmit();
        const privacySuccess = await handlePrivacySubmit();
        setIsSaving(false);
        if (!allowedDomainSuccess || !privacySuccess) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
        setShowTabSwitchError(false);

        // allows modal to close immediately
        setAreThereUnsavedChanges(false);
    }, [isSaving, handleAllowedDomainsSubmit, handlePrivacySubmit, setShowTabSwitchError, setAreThereUnsavedChanges]);

    let modeFlipMessage;
    if (modeFlipMemberCount === null) {
        modeFlipMessage = (
            <FormattedMessage
                id='team_settings.mode_flip_confirm.message_generic'
                defaultMessage='Switching to Private will activate strict ABAC enforcement. Some members may not meet the current policy criteria and will be removed at the next sync.'
            />
        );
    } else if (modeFlipMemberCount === 0) {
        modeFlipMessage = (
            <FormattedMessage
                id='team_settings.mode_flip_confirm.message_no_removals'
                defaultMessage='Switching to Private will activate strict ABAC enforcement. All current members meet the criteria, so no one will be removed at the next sync.'
            />
        );
    } else {
        modeFlipMessage = (
            <FormattedMessage
                id='team_settings.mode_flip_confirm.message_with_count'
                defaultMessage='Switching to Private will activate strict ABAC enforcement. {count} current {count, plural, one {member does} other {members do}} not meet criteria and will be removed at the next sync.'
                values={{count: modeFlipMemberCount}}
            />
        );
    }

    return (
        <div
            className='modal-access-tab-content user-settings'
            id='accessSettings'
            aria-labelledby='accessButton'
            role='tabpanel'
        >
            <OpenInvite
                isPublic={isPublicTeam}
                isGroupConstrained={team.group_constrained}
                onChange={handlePrivacyChange}
            />
            {!team.group_constrained && (
                <>
                    <div className='divider-light'/>
                    <AllowedDomainsSelect
                        allowedDomains={allowedDomains}
                        setAllowedDomains={setAllowedDomains}
                        setHasChanges={setAreThereUnsavedChanges}
                        setSaveChangesPanelState={setSaveChangesPanelState}
                    />
                </>
            )}
            <div className='divider-light'/>
            {!team.group_constrained && (
                <InviteSectionInput regenerateTeamInviteId={actions.regenerateTeamInviteId}/>
            )}
            {(areThereUnsavedChanges || saveChangesPanelState === 'saved') && (
                <SaveChangesPanel
                    handleCancel={handleCancel}
                    handleSubmit={handleSaveChanges}
                    handleClose={handleClose}
                    tabChangeError={showTabSwitchError}
                    state={saveChangesPanelState}
                    saving={isSaving}
                />
            )}

            <ConfirmModal
                show={showModeFlipModal}
                title={
                    <FormattedMessage
                        id='team_settings.mode_flip_confirm.title'
                        defaultMessage='Switch to Private Team?'
                    />
                }
                message={modeFlipMessage}
                confirmButtonText={
                    <FormattedMessage
                        id='team_settings.mode_flip_confirm.confirm'
                        defaultMessage='Switch to Private'
                    />
                }
                cancelButtonText={
                    <FormattedMessage
                        id='team_settings.mode_flip_confirm.cancel'
                        defaultMessage='Cancel'
                    />
                }
                onConfirm={handleModeFlipConfirm}
                onCancel={handleModeFlipCancel}
                isStacked={true}
            />

            <ConfirmModal
                show={showSelfExclusionModal}
                title={
                    <FormattedMessage
                        id='team_settings.mode_flip_self_exclusion.title'
                        defaultMessage='Cannot switch to Private Team'
                    />
                }
                message={
                    <FormattedMessage
                        id='team_settings.mode_flip_self_exclusion.message'
                        defaultMessage='You do not meet the current membership rules, so switching to Private would remove you from the team at the next sync. Update the rules to include yourself, or ask another admin to make the switch.'
                    />
                }
                confirmButtonText={
                    <FormattedMessage
                        id='team_settings.mode_flip_self_exclusion.confirm'
                        defaultMessage='Back to editing'
                    />
                }
                onConfirm={() => setShowSelfExclusionModal(false)}
                onCancel={() => setShowSelfExclusionModal(false)}
                hideCancel={true}
                isStacked={true}
            />
        </div>
    );
};

export default AccessTab;
