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

const AccessTab = ({showTabSwitchError, areThereUnsavedChanges, setShowTabSwitchError, setAreThereUnsavedChanges, team, actions}: Props) => {
    const [allowedDomains, setAllowedDomains] = useState<string[]>(() => generateAllowedDomainOptions(team.allowed_domains));
    const isPublicTeamInitial = team.type === 'O' && (team.allow_open_invite ?? false);
    const [isPublicTeam, setIsPublicTeam] = useState<boolean>(isPublicTeamInitial);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();

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
        const {error} = await actions.patchTeam({
            id: team.id,
            type: isPublicTeam ? 'O' : 'I',
            allow_open_invite: isPublicTeam,
        });
        if (error) {
            return false;
        }
        return true;
    }, [actions, isPublicTeam, isPublicTeamInitial, team]);

    const computeModeFlipCount = useCallback(async (): Promise<number | null> => {
        try {
            const [policyResult, statsResult] = await Promise.all([
                actions.getTeamAccessControlPolicy(team.id),
                actions.getTeamStats(team.id),
            ]);

            const policyData = policyResult?.data as {policy: AccessControlPolicy | null; enforced: boolean} | undefined;
            const expression = getMembershipRule(policyData?.policy?.rules)?.expression ?? '';

            if (!expression) {
                return null;
            }

            const usersResult = await actions.searchUsersForExpression(expression, '', '', 1000, undefined, team.id);
            const qualifyingCount = usersResult?.data?.total ?? 0;
            const totalCount = statsResult?.data?.total_member_count ?? null;

            if (totalCount === null) {
                return null;
            }

            return Math.max(0, totalCount - qualifyingCount);
        } catch {
            return null;
        }
    }, [actions, team.id]);

    const handlePrivacyChange = useCallback(async (newIsPublic: boolean) => {
        setAreThereUnsavedChanges(true);
        setSaveChangesPanelState('editing');

        if (!newIsPublic && isPublicTeam && team.policy_enforced) {
            pendingPublicValueRef.current = newIsPublic;
            const count = await computeModeFlipCount();
            setModeFlipMemberCount(count);
            setShowModeFlipModal(true);
            return;
        }

        setIsPublicTeam(newIsPublic);
    }, [isPublicTeam, team.policy_enforced, computeModeFlipCount, setAreThereUnsavedChanges]);

    const handleModeFlipConfirm = useCallback(async () => {
        setShowModeFlipModal(false);
        if (pendingPublicValueRef.current !== null) {
            setIsPublicTeam(pendingPublicValueRef.current);
            pendingPublicValueRef.current = null;
        }

        if (team.policy_enforced) {
            try {
                await actions.createAccessControlTeamSyncJob({policy_id: team.id});
            } catch {
                // Job creation failure does not block the privacy change
            }
        }
    }, [actions, team.id, team.policy_enforced]);

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
        const allowedDomainSuccess = await handleAllowedDomainsSubmit();
        const privacySuccess = await handlePrivacySubmit();
        if (!allowedDomainSuccess || !privacySuccess) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
        setShowTabSwitchError(false);

        // allows modal to close immediately
        setAreThereUnsavedChanges(false);
    }, [handleAllowedDomainsSubmit, handlePrivacySubmit, setShowTabSwitchError, setAreThereUnsavedChanges]);

    const modeFlipMessage = modeFlipMemberCount !== null ? (
        <FormattedMessage
            id='team_settings.mode_flip_confirm.message_with_count'
            defaultMessage='Switching to Private will activate strict ABAC enforcement. {count} current {count, plural, one {member does} other {members do}} not meet criteria and will be removed at the next sync.'
            values={{count: modeFlipMemberCount}}
        />
    ) : (
        <FormattedMessage
            id='team_settings.mode_flip_confirm.message_generic'
            defaultMessage='Switching to Private will activate strict ABAC enforcement. Some members may not meet the current policy criteria and will be removed at the next sync.'
        />
    );

    return (
        <div
            className='modal-access-tab-content user-settings'
            id='accessSettings'
            aria-labelledby='accessButton'
            role='tabpanel'
        >
            {!team.group_constrained && (
                <AllowedDomainsSelect
                    allowedDomains={allowedDomains}
                    setAllowedDomains={setAllowedDomains}
                    setHasChanges={setAreThereUnsavedChanges}
                    setSaveChangesPanelState={setSaveChangesPanelState}
                />
            )}
            <div className='divider-light'/>
            <OpenInvite
                isPublic={isPublicTeam}
                isGroupConstrained={team.group_constrained}
                policyEnforced={team.policy_enforced}
                onChange={handlePrivacyChange}
            />
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
