// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, useRef} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import {getMembershipRule} from '@mattermost/types/access_control';

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

    const computeModeFlipCount = useCallback(async (): Promise<number | null> => {
        try {
            const policyResult = await actions.getTeamAccessControlPolicy(team.id);
            const policyData = policyResult?.data as {policy: AccessControlPolicy | null; enforced: boolean} | undefined;
            const expression = getMembershipRule(policyData?.policy?.rules)?.expression ?? '';

            if (!expression) {
                return null;
            }

            // Count the members who would be removed as (active members) minus
            // (members matching the rules). Both counts come from the server:
            // searchUsersForExpression with the team id scopes the match count to
            // this team's members, and the stats endpoint gives the active total.
            // This avoids paging the member list, which the server caps at 200 per
            // request and would silently undercount on larger teams.
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
            const count = await computeModeFlipCount();
            setModeFlipMemberCount(count);
            setShowModeFlipModal(true);
            return;
        }

        setIsPublicTeam(newIsPublic);
    }, [isPublicTeam, teamAbacActive, computeModeFlipCount, setAreThereUnsavedChanges]);

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

    const modeFlipMessage = modeFlipMemberCount === null ? (
        <FormattedMessage
            id='team_settings.mode_flip_confirm.message_generic'
            defaultMessage='Switching to Private will activate strict ABAC enforcement. Some members may not meet the current policy criteria and will be removed at the next sync.'
        />
    ) : (
        <FormattedMessage
            id='team_settings.mode_flip_confirm.message_with_count'
            defaultMessage='Switching to Private will activate strict ABAC enforcement. {count} current {count, plural, one {member does} other {members do}} not meet criteria and will be removed at the next sync.'
            values={{count: modeFlipMemberCount}}
        />
    );

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
                policyEnforced={team.policy_enforced}
                policyIsActive={team.policy_is_active}
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
        </div>
    );
};

export default AccessTab;
