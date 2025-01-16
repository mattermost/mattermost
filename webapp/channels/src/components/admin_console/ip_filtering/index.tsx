// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';
import type {AllowedIPRange, FetchIPResponse} from '@mattermost/types/config';

import {applyIPFilters, getCurrentIP, getIPFilters} from 'actions/admin_actions';
import {getInstallation} from 'actions/cloud';
import {closeModal, openModal} from 'actions/views/modals';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import {ModalIdentifiers} from 'utils/constants';

import IPFilteringAddOrEditModal from './add_edit_ip_filter_modal';
import DeleteConfirmationModal from './delete_confirmation';
import EditSection from './edit_section';
import EnableSectionContent from './enable_section';
import {isIPAddressInRanges} from './ip_filtering_utils';
import SaveConfirmationModal from './save_confirmation_modal';

import SaveChangesPanel from '../save_changes_panel';

import './ip_filtering.scss';

const IPFiltering = () => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [ipFilters, setIpFilters] = useState<AllowedIPRange[] | null>(null);
    const [originalIpFilters, setOriginalIpFilters] = useState<AllowedIPRange[] | null>(null);
    const [saveNeeded, setSaveNeeded] = useState(false);
    const [currentUsersIP, setCurrentUsersIP] = useState<string | null>(null);
    const [saving, setSaving] = useState<boolean>(false);
    const [filterToggle, setFilterToggle] = useState<boolean>(false);
    const [installationStatus, setInstallationStatus] = useState<string>('');

    // savingMessage allows the component to change the label on the Save button in the SaveChangesPanel
    const [savingMessage, setSavingMessage] = useState<string>('');

    // savingDescription is a JSX element that will be displayed in the serverError bar on the SaveChangesPanel. This allows us to provide more information on loading while previous changes are applied
    const [savingDescription, setSavingDescription] = useState<JSX.Element | null>(null);

    const savingButtonMessages = {
        SAVING_PREVIOUS_CHANGE: formatMessage({id: 'admin.ip_filtering.saving_previous_change', defaultMessage: 'Other changes being applied...'}),
        SAVING_CHANGES: formatMessage({id: 'admin.ip_filtering.saving_changes', defaultMessage: 'Applying changes...'}),
    };

    const savingDescriptionMessages = {
        SAVING_PREVIOUS_CHANGE: formatMessage({id: 'admin.ip_filtering.saving_previous_change_description', defaultMessage: 'Please wait while changes from another admin are applied.'}),
        SAVING_CHANGES: formatMessage({id: 'admin.ip_filtering.saving_changes_description', defaultMessage: 'Please wait while your changes are applied.'}),
    };

    useEffect(() => {
        getInstallationStatus();

        getIPFilters((data: AllowedIPRange[]) => {
            setIpFilters(data);
            setOriginalIpFilters(data);
        });

        getCurrentIP((res: FetchIPResponse) => {
            setCurrentUsersIP(res.ip);
        });
    }, []);

    useEffect(() => {
        if (ipFilters === null || originalIpFilters === null) {
            return;
        }

        // Check if the ipFilters list differs from the originalIpFilters list
        const haveFiltersChanged = JSON.stringify(ipFilters) !== JSON.stringify(originalIpFilters);
        setSaveNeeded(haveFiltersChanged);
    }, [ipFilters, originalIpFilters]);

    const currentIPIsInRange = (): boolean => {
        if (!filterToggle) {
            return true;
        }
        if (!ipFilters?.length) {
            return true;
        }
        return ipFilters !== null && currentUsersIP !== null && isIPAddressInRanges(currentUsersIP, ipFilters);
    };

    useEffect(() => {
        if (!ipFilters?.length) {
            return;
        }
        setFilterToggle(ipFilters?.some((filter: AllowedIPRange) => filter.enabled === true) ?? false);
    }, [ipFilters]);

    useEffect(() => {
        if (filterToggle === false) {
            setIpFilters(ipFilters?.map((filter: AllowedIPRange): AllowedIPRange => {
                return {
                    ...filter,
                    enabled: false,
                };
            }) || []);
        } else {
            setIpFilters(ipFilters?.map((filter: AllowedIPRange): AllowedIPRange => {
                return {
                    ...filter,
                    enabled: true,
                };
            }) || []);
        }
    }, [filterToggle]);

    function pollInstallationStatus() {
        let installationFetchAttempts = 0;
        const interval = setInterval(async () => {
            if (installationFetchAttempts > 15) {
                // Average time for provisioner to update is around 30 seconds. This allows up to 75 seconds before it will stop fetching, displaying an error
                setSavingDescription((
                    <>
                        <AlertOutlineIcon size={16}/> {formatMessage({id: 'admin.ip_filtering.failed_to_fetch_installation_state', defaultMessage: 'Failed to fetch your workspace\'s status. Please try again later or contact support.'})}
                    </>
                ));
                clearInterval(interval);
                return;
            }
            const result = await dispatch(getInstallation());
            installationFetchAttempts++;
            if (result.data) {
                const {data} = result;
                if (data.state === 'stable') {
                    setSaving(false);
                    setSavingDescription(null);
                    clearInterval(interval);
                }
                setInstallationStatus(data.state);
            }
        }, 5000);
    }

    async function getInstallationStatus() {
        const result = await dispatch(getInstallation());
        if (result.data) {
            const {data} = result;
            setInstallationStatus(data.state);
            if (installationStatus === '' && data.state !== 'stable') {
                // This is the first load of the page, and the installation is not stable, so we must lock saving until it becomes stable
                setSaving(true);

                // Override the default messages for the save button and the error message to be communicative of the current state to the user
                setSavingMessage(savingButtonMessages.SAVING_PREVIOUS_CHANGE);
                changeSavingDescription(savingDescriptionMessages.SAVING_PREVIOUS_CHANGE);
            }
            if (data.state !== 'stable') {
                pollInstallationStatus();
            }
        }
    }

    function changeSavingDescription(text: string) {
        setSavingDescription((
            <div className='saving-message-description'>
                {text}
            </div>
        ),
        );
    }

    function handleEditFilter(filter: AllowedIPRange, existingRange?: AllowedIPRange) {
        setIpFilters((prevIpFilters) => {
            if (!prevIpFilters) {
                return [filter];
            }
            const index = prevIpFilters.findIndex((f) => f.cidr_block === existingRange?.cidr_block);
            if (index === -1) {
                return null;
            }
            const updatedFilters = [...prevIpFilters];
            updatedFilters[index] = filter;
            return updatedFilters;
        });
        setSaveNeeded(true);
    }

    function showAddModal() {
        dispatch(openModal({
            modalId: ModalIdentifiers.IP_FILTERING_ADD_EDIT_MODAL,
            dialogType: IPFilteringAddOrEditModal,
            dialogProps: {
                currentIP: currentUsersIP!,
                onSave: handleAddFilter,
            },
        }));
    }

    function showEditModal(editFilter: AllowedIPRange) {
        dispatch(openModal({
            modalId: ModalIdentifiers.IP_FILTERING_ADD_EDIT_MODAL,
            dialogType: IPFilteringAddOrEditModal,
            dialogProps: {
                currentIP: currentUsersIP!,
                onSave: handleEditFilter,
                existingRange: editFilter!,
            },
        }));
    }

    function showConfirmDeleteFilterModal(filter: AllowedIPRange) {
        dispatch(openModal({
            modalId: ModalIdentifiers.IP_FILTERING_DELETE_CONFIRMATION_MODAL,
            dialogType: DeleteConfirmationModal,
            dialogProps: {
                onConfirm: handleDeleteFilter,
                filterToDelete: filter,
            },
        }));
    }

    function handleDeleteFilter(filter: AllowedIPRange) {
        dispatch(closeModal(ModalIdentifiers.IP_FILTERING_DELETE_CONFIRMATION_MODAL));
        setIpFilters((prevIpFilters) => prevIpFilters?.filter((f) => f.cidr_block !== filter.cidr_block) ?? null);
        setSaveNeeded(true);
    }

    function handleAddFilter(filter: AllowedIPRange) {
        dispatch(closeModal(ModalIdentifiers.IP_FILTERING_ADD_EDIT_MODAL));
        setIpFilters((prevIpFilters) => [...(prevIpFilters ?? []), filter]);
        setSaveNeeded(true);
    }

    function handleSave() {
        setInstallationStatus('update-requested');
        setSaving(true);
        setSavingMessage(savingButtonMessages.SAVING_CHANGES);
        changeSavingDescription(savingDescriptionMessages.SAVING_CHANGES);
        dispatch(closeModal(ModalIdentifiers.IP_FILTERING_SAVE_CONFIRMATION_MODAL));

        const success = (data: AllowedIPRange[]) => {
            setIpFilters(data);
            setOriginalIpFilters(data);
            getInstallationStatus();
        };

        applyIPFilters(ipFilters ?? [], success);
    }

    function handleSaveClick() {
        const saveConfirmModalProps = {
            onConfirm: handleSave,
        } as any;
        if (!ipFilters?.length && filterToggle) {
            saveConfirmModalProps.title = formatMessage({id: 'admin.ip_filtering.apply_ip_filter_changes', defaultMessage: 'Apply IP Filter Changes'});
            saveConfirmModalProps.subtitle = (
                <FormattedMessage
                    id={'admin.ip_filtering.no_filters_added'}
                    defaultMessage={'Are you sure you want to apply these IP filter changes? There are currently no filters added, so <strong>all IP addresses will have access to the workspace.</strong>'}
                    values={{
                        strong: (content: string) => <strong>{content}</strong>,
                    }}
                />
            );
            saveConfirmModalProps.buttonText = formatMessage({id: 'admin.ip_filtering.apply_changes', defaultMessage: 'Yes, apply changes'});
            saveConfirmModalProps.includeDisclaimer = false;
        } else if ((ipFilters?.length && !filterToggle) || (!ipFilters?.length && !filterToggle)) {
            saveConfirmModalProps.title = formatMessage({id: 'admin.ip_filtering.disable_ip_filtering', defaultMessage: 'Disable IP Filtering'});
            saveConfirmModalProps.subtitle = (
                <FormattedMessage
                    id={'admin.ip_filtering.turn_off_ip_filtering'}
                    defaultMessage={'Are you sure you want to turn off IP Filtering? <strong>All IP addresses will have access to the workspace.</strong>'}
                    values={{
                        strong: (content: string) => <strong>{content}</strong>,
                    }}
                />
            );
            saveConfirmModalProps.buttonText = formatMessage({id: 'admin.ip_filtering.yes_disable_ip_filtering', defaultMessage: 'Yes, disable IP Filtering'});
            saveConfirmModalProps.includeDisclaimer = false;
        } else {
            saveConfirmModalProps.title = formatMessage({id: 'admin.ip_filtering.apply_ip_filter_changes', defaultMessage: 'Apply IP Filter Changes'});
            saveConfirmModalProps.subtitle = (
                <FormattedMessage
                    id={'admin.ip_filtering.apply_ip_filter_changes_are_you_sure'}
                    defaultMessage={'Are you sure you want to apply these IP Filter changes? <strong>Users with IP addresses outside of the IP ranges provided will no longer have access to the workspace.</strong>'}
                    values={{
                        strong: (content: string) => <strong>{content}</strong>,
                    }}
                />
            );
            saveConfirmModalProps.buttonText = formatMessage({id: 'admin.ip_filtering.apply_changes', defaultMessage: 'Yes, apply changes'});
            saveConfirmModalProps.includeDisclaimer = true;
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.IP_FILTERING_SAVE_CONFIRMATION_MODAL,
            dialogType: SaveConfirmationModal,
            dialogProps: saveConfirmModalProps,
        }));
    }

    const saveBarError = () => {
        if (savingDescription !== null) {
            return savingDescription;
        }

        if (currentIPIsInRange()) {
            return undefined;
        }

        return (
            <>
                <AlertOutlineIcon size={16}/> {formatMessage({id: 'admin.ip_filtering.error_on_page', defaultMessage: 'Your IP address is not included in your filters'})}
            </>
        );
    };

    return (
        <div className='IPFiltering wrapper--fixed'>
            <AdminHeader>
                {formatMessage({id: 'admin.ip_filtering.ip_filtering', defaultMessage: 'IP Filtering'})}
            </AdminHeader>
            <div className='MainPanel admin-console__wrapper'>
                <>
                    <EnableSectionContent
                        filterToggle={filterToggle}
                        setFilterToggle={setFilterToggle}
                    />
                    {ipFilters !== null && currentUsersIP !== null && filterToggle &&
                        <EditSection
                            ipFilters={ipFilters}
                            currentUsersIP={currentUsersIP}
                            setShowAddModal={showAddModal}
                            setEditFilter={showEditModal}
                            handleConfirmDeleteFilter={showConfirmDeleteFilterModal}
                            currentIPIsInRange={currentIPIsInRange()}
                        />
                    }
                </>
            </div>
            <SaveChangesPanel
                saving={saving}
                saveNeeded={saveNeeded || installationStatus !== 'stable'}
                isDisabled={!currentIPIsInRange() || installationStatus !== 'stable'}
                onClick={handleSaveClick}
                serverError={saveBarError()}
                savingMessage={savingMessage}
                cancelLink=''
            />
        </div>
    );
};

export default IPFiltering;
