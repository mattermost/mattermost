// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';
import type {AllowedIPRange, FetchIPResponse} from '@mattermost/types/config';

import {applyIPFilters, getCurrentIP, getIPFilters} from 'actions/admin_actions';
import {closeModal, openModal} from 'actions/views/modals';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import {ModalIdentifiers} from 'utils/constants';

import IPFilteringAddOrEditModal from './add_edit_ip_filter_modal';
import DeleteConfirmationModal from './delete_confirmation';
import EditSection from './edit_section';
import EnableSectionContent from './enable_section';
import {isIPAddressInRanges} from './ip_filtering_utils';
import SaveConfirmationModal from './save_confirmation_modal';

import SaveChangesPanel from '../team_channel_settings/save_changes_panel';

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

    useEffect(() => {
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

    const currentIPIsInRange = () => {
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
        setSaving(true);
        dispatch(closeModal(ModalIdentifiers.IP_FILTERING_SAVE_CONFIRMATION_MODAL));

        const success = (data: AllowedIPRange[]) => {
            setIpFilters(data);
            setSaving(false);
            setSaveNeeded(false);
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
                saveNeeded={saveNeeded}
                isDisabled={!currentIPIsInRange}
                onClick={handleSaveClick}
                serverError={saveBarError()}
                cancelLink=''
            />
        </div>
    );
};

export default IPFiltering;
