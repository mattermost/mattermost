// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import {RefreshIcon} from '@mattermost/compass-icons/components';
import type {Team} from '@mattermost/types/teams';

import SelectTextInput, {type SelectTextInputOption} from 'components/common/select_text_input/select_text_input';
import Input from 'components/widgets/inputs/input/input';
import BaseSettingItem, {type BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';
import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';
import ModalSection from 'components/widgets/modals/components/modal_section';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import OpenInvite from './open_invite';

import type {PropsFromRedux, OwnProps} from '.';

import './team_access_tab.scss';

type Props = PropsFromRedux & OwnProps;

const AccessTab = (props: Props) => {
    const generateAllowedDomainOptions = (allowedDomains?: string) => {
        if (!allowedDomains || allowedDomains.length === 0) {
            return [];
        }
        const domainList = allowedDomains.includes(',') ? allowedDomains.split(',') : [allowedDomains];
        return domainList.map((domain) => domain.trim());
    };

    const [inviteId, setInviteId] = useState<Team['invite_id']>(props.team?.invite_id ?? '');
    const [allowedDomains, setAllowedDomains] = useState<string[]>(generateAllowedDomainOptions(props.team?.allowed_domains));
    const [showAllowedDomains, setShowAllowedDomains] = useState<boolean>(allowedDomains?.length > 0);
    const [allowOpenInvite, setAllowOpenInvite] = useState<boolean>(props.team?.allow_open_invite ?? false);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>('saving');
    const [inviteIdError, setInviteIdError] = useState<BaseSettingItemProps['error'] | undefined>();
    const {formatMessage} = useIntl();

    const handleAllowedDomainsSubmit = async (): Promise<boolean> => {
        if (allowedDomains.length === 0) {
            return true;
        }
        const {error} = await props.actions.patchTeam({
            id: props.team?.id,
            allowed_domains: allowedDomains.length === 1 ? allowedDomains[0] : allowedDomains.join(', '),
        });
        if (error) {
            return false;
        }
        return true;
    };

    const handleOpenInviteSubmit = async (): Promise<boolean> => {
        if (allowOpenInvite === props.team?.allow_open_invite) {
            return true;
        }
        const data = {
            id: props.team?.id,
            allow_open_invite: allowOpenInvite,
        };

        const {error} = await props.actions.patchTeam(data);
        if (error) {
            return false;
        }
        return true;
    };

    const updateAllowedDomains = (domain: string) => {
        props.setHasChanges(true);
        setSaveChangesPanelState('saving');
        setAllowedDomains((prev) => [...prev, domain]);
    };
    const updateOpenInvite = (value: boolean) => {
        props.setHasChanges(true);
        setSaveChangesPanelState('saving');
        setAllowOpenInvite(value);
    };
    const handleOnChangeDomains = (allowedDomainsOptions?: SelectTextInputOption[] | null) => {
        props.setHasChanges(true);
        setSaveChangesPanelState('saving');
        setAllowedDomains(allowedDomainsOptions?.map((domain) => domain.value) || []);
    };
    const handleRegenerateInviteId = async () => {
        const {data, error} = await props.actions.regenerateTeamInviteId(props.team?.id || '');

        if (data?.invite_id) {
            setInviteId(data.invite_id);
            return;
        }

        if (error) {
            setInviteIdError({id: 'team_settings.openInviteDescription.error', defaultMessage: 'There was an error generating the invite code, please try again'});
        }
    };

    const handleEnableAllowedDomains = (enabled: boolean) => {
        setShowAllowedDomains(enabled);
        if (!enabled) {
            setAllowedDomains([]);
        }
    };

    const handleCancel = () => {
        setAllowedDomains(generateAllowedDomainOptions(props.team?.allowed_domains));
        setAllowOpenInvite(props.team?.allow_open_invite ?? false);
        handleClose();
    };

    const handleClose = () => {
        setSaveChangesPanelState('saving');
        props.setHasChanges(false);
        props.setHasChangeTabError(false);
    };

    const collapseModal = () => {
        if (props.hasChanges) {
            props.setHasChangeTabError(true);
            return;
        }
        props.collapseModal();
    };

    const handleSaveChanges = async () => {
        const allowedDomainSuccess = await handleAllowedDomainsSubmit();
        const openInviteSuccess = await handleOpenInviteSubmit();
        if (!allowedDomainSuccess || !openInviteSuccess) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
        props.setHasChangeTabError(false);
    };

    let inviteSection;
    if (props.canInviteTeamMembers) {
        const inviteSectionInput = (
            <div
                data-testid='teamInviteContainer'
                id='teamInviteContainer'
            >
                <Input
                    id='teamInviteId'
                    type='text'
                    value={inviteId}
                    maxLength={32}
                />
                <button
                    data-testid='regenerateButton'
                    id='regenerateButton'
                    className='btn btn-tertiary'
                    onClick={handleRegenerateInviteId}
                >
                    <RefreshIcon/>
                    {formatMessage({id: 'general_tab.regenerate', defaultMessage: 'Regenerate'})}
                </button>
            </div>
        );

        inviteSection = (
            <BaseSettingItem
                className='access-invite-section'
                title={{id: 'general_tab.codeTitle', defaultMessage: 'Invite Code'}}
                description={{id: 'general_tab.codeLongDesc', defaultMessage: 'The Invite Code is part of the unique team invitation link which is sent to members you’re inviting to this team. Regenerating the code creates a new invitation link and invalidates the previous link.'}}
                content={inviteSectionInput}
                error={inviteIdError}
                descriptionAboveContent={true}
            />
        );
    }

    const allowedDomainsSection = (
        <>
            <CheckboxSettingItem
                data-testid='allowedDomainsCheckbox'
                className='access-allowed-domains-section'
                title={{id: 'general_tab.allowedDomainsTitle', defaultMessage: 'Users with a specific email domain'}}
                description={{id: 'general_tab.allowedDomainsInfo', defaultMessage: 'When enabled, users can only join the team if their email matches a specific domain (e.g. "mattermost.org")'}}
                descriptionAboveContent={true}
                inputFieldData={{title: {id: 'general_tab.allowedDomains', defaultMessage: 'Allow only users with a specific email domain to join this team'}, name: 'name'}}
                inputFieldValue={showAllowedDomains}
                handleChange={handleEnableAllowedDomains}
            />
            {showAllowedDomains &&
                <SelectTextInput
                    id='allowedDomains'
                    placeholder={formatMessage({id: 'general_tab.AllowedDomainsExample', defaultMessage: 'corp.mattermost.com, mattermost.com'})}
                    aria-label={formatMessage({id: 'general_tab.allowedDomains.ariaLabel', defaultMessage: 'Allowed Domains'})}
                    value={allowedDomains}
                    onChange={handleOnChangeDomains}
                    handleNewSelection={updateAllowedDomains}
                    isClearable={false}
                    description={formatMessage({id: 'general_tab.AllowedDomainsTip', defaultMessage: 'Seperate multiple domains with a space or comma.'})}
                />
            }
        </>
    );

    return (
        <ModalSection
            content={
                <>
                    <div className='modal-header'>
                        <button
                            id='closeButton'
                            type='button'
                            className='close'
                            data-dismiss='modal'
                            onClick={props.closeModal}
                        >
                            <span aria-hidden='true'>{'×'}</span>
                        </button>
                        <h4 className='modal-title'>
                            <div className='modal-back'>
                                <i
                                    className='fa fa-angle-left'
                                    aria-label={formatMessage({
                                        id: 'generic_icons.collapse',
                                        defaultMessage: 'Collapes Icon',
                                    })}
                                    onClick={collapseModal}
                                />
                            </div>
                            <span>{formatMessage({id: 'team_settings_modal.title', defaultMessage: 'Team Settings'})}</span>
                        </h4>
                    </div>
                    <div className='modal-access-tab-content user-settings'>
                        {props.team?.group_constrained ? undefined : allowedDomainsSection}
                        <div className='divider-light'/>
                        <OpenInvite
                            isGroupConstrained={props.team?.group_constrained}
                            allowOpenInvite={allowOpenInvite}
                            setAllowOpenInvite={updateOpenInvite}
                        />
                        <div className='divider-light'/>
                        {props.team?.group_constrained ? undefined : inviteSection}
                        {props.hasChanges ?
                            <SaveChangesPanel
                                handleCancel={handleCancel}
                                handleSubmit={handleSaveChanges}
                                handleClose={handleClose}
                                tabChangeError={props.hasChangeTabError}
                                state={saveChangesPanelState}
                            /> : undefined}
                    </div>
                </>
            }
        />
    );
};
export default AccessTab;
