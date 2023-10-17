// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';
import type {AllowedIPRange, FetchIPResponse} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import IPFilteringAddOrEditModal from './add_edit_ip_filter_modal';
import DeleteConfirmationModal from './delete_confirmation';
import EditSection from './edit_section';
import EnableSectionContent from './enable_section';
import {isIPAddressInRanges} from './ip_filtering_utils';
import SaveConfirmationModal from './save_confirmation_modal';

import SaveChangesPanel from '../team_channel_settings/save_changes_panel';

import './ip_filtering.scss';

const IPFiltering = () => {
    const {formatMessage} = useIntl();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editFilter, setEditFilter] = useState<AllowedIPRange | null>(null);
    const [ipFilters, setIpFilters] = useState<AllowedIPRange[] | null>(null);
    const [originalIpFilters, setOriginalIpFilters] = useState<AllowedIPRange[] | null>(null);
    const [saveNeeded, setSaveNeeded] = useState(false);
    const [filterToDelete, setFilterToDelete] = useState<AllowedIPRange | null>(null);
    const [currentUsersIP, setCurrentUsersIP] = useState<string | null>(null);
    const [currentIPIsInRange, setCurrentIPIsInRange] = useState<boolean>(false);
    const [saveConfirmationModal, setSaveConfirmationModal] = useState<JSX.Element | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const [filterToggle, setFilterToggle] = useState<boolean>(false);

    useEffect(() => {
        Client4.getIPFilters().then((res) => {
            setIpFilters(res as AllowedIPRange[]);
            setOriginalIpFilters(res as AllowedIPRange[]);
        });

        Client4.getCurrentIP().then((res) => {
            setCurrentUsersIP((res as FetchIPResponse)?.IP);
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

    useEffect(() => {
        if (!filterToggle) {
            setCurrentIPIsInRange(true);
            return;
        }
        if (!ipFilters?.length) {
            setCurrentIPIsInRange(true);
            return;
        }
        setCurrentIPIsInRange(ipFilters !== null && currentUsersIP !== null && isIPAddressInRanges(currentUsersIP, ipFilters));
    }, [ipFilters, currentUsersIP, filterToggle]);

    useEffect(() => {
        if (!ipFilters?.length) {
            return;
        }
        setFilterToggle(ipFilters?.some((filter: AllowedIPRange) => filter.Enabled === true) ?? false);
    }, [ipFilters]);

    useEffect(() => {
        if (filterToggle === false) {
            setIpFilters(ipFilters?.map((filter: AllowedIPRange): AllowedIPRange => {
                return {
                    ...filter,
                    Enabled: false,
                };
            }) || []);
        } else {
            setIpFilters(ipFilters?.map((filter: AllowedIPRange): AllowedIPRange => {
                return {
                    ...filter,
                    Enabled: true,
                };
            }) || []);
        }
    }, [filterToggle]);

    function handleEditFilter(filter: AllowedIPRange, existingRange?: AllowedIPRange) {
        setIpFilters((prevIpFilters) => {
            if (!prevIpFilters) {
                return [filter];
            }
            const index = prevIpFilters.findIndex((f) => f.CIDRBlock === existingRange?.CIDRBlock);
            if (index === -1) {
                return null;
            }
            const updatedFilters = [...prevIpFilters];
            updatedFilters[index] = filter;
            return updatedFilters;
        });
        setSaveNeeded(true);
    }

    function handleConfirmDeleteFilter(filter: AllowedIPRange) {
        setFilterToDelete(filter);
    }

    function handleDeleteFilter(filter: AllowedIPRange) {
        setIpFilters((prevIpFilters) => prevIpFilters?.filter((f) => f.CIDRBlock !== filter.CIDRBlock) ?? null);
        setFilterToDelete(null);
    }

    function handleAddFilter(filter: AllowedIPRange) {
        setIpFilters((prevIpFilters) => [...(prevIpFilters ?? []), filter]);
        setSaveNeeded(true);
    }

    function handleSave() {
        setSaving(true);
        setSaveConfirmationModal(null);

        Client4.applyIPFilters(ipFilters ?? []).then((res) => {
            setIpFilters(res as AllowedIPRange[]);
            setSaving(false);
            setSaveNeeded(false);
        });
    }

    function handleSaveClick() {
        const saveConfirmModalProps = {
            onClose: () => {
                setSaveConfirmationModal(null);
            },
            onConfirm: handleSave,
        } as any;
        if (!ipFilters?.length && filterToggle) {
            saveConfirmModalProps.title = formatMessage({id: 'admin.ip_filtering.apply_ip_filter_changes', defaultMessage: 'Apply IP Filter Changes'});
            saveConfirmModalProps.subtitle = <>{formatMessage({id: 'admin.ip_filtering.no_filters_added', defaultMessage: 'Are you sure you want to apply these IP filter changes? There are currently no filters added, so {strong}'}, {strong: (<strong>{formatMessage({id: 'admin.ip_filtering.all_ip_addresses_will_have_access_midsentence', defaultMessage: 'all IP addresses will have access to the workspace.'})}</strong>)})}</>;
            saveConfirmModalProps.buttonText = formatMessage({id: 'admin.ip_filtering.apply_changes', defaultMessage: 'Yes, apply changes'});
            saveConfirmModalProps.includeDisclaimer = false;
        } else if ((ipFilters?.length && !filterToggle) || (!ipFilters?.length && !filterToggle)) {
            saveConfirmModalProps.title = formatMessage({id: 'admin.ip_filtering.disable_ip_filtering', defaultMessage: 'Disable IP Filtering'});
            saveConfirmModalProps.subtitle = <>{formatMessage({id: 'admin.ip_filtering.turn_off_ip_filtering', defaultMessage: 'Are you sure you want to turn off IP Filtering? {strong}'}, {strong: (<strong>{formatMessage({id: 'admin.ip_filtering.all_ip_addresses_will_have_access', defaultMessage: 'All IP addresses will have access to the workspace.'})}</strong>)})}</>;
            saveConfirmModalProps.buttonText = formatMessage({id: 'admin.ip_filtering.yes_disable_ip_filtering', defaultMessage: 'Yes, disable IP Filtering'});
            saveConfirmModalProps.includeDisclaimer = false;
        } else {
            saveConfirmModalProps.title = formatMessage({id: 'admin.ip_filtering.apply_ip_filter_changes', defaultMessage: 'Apply IP Filter Changes'});
            saveConfirmModalProps.subtitle = <>{formatMessage({id: 'admin.ip_filtering.apply_ip_filter_changes_are_you_sure', defaultMessage: 'Are you sure you want to apply these IP Filter changes? {strong}'}, {strong: (<strong>{formatMessage({id: 'admin.ip_filtering.users_with_ip_addresses_outside_ip_ranges', defaultMessage: 'Users with IP addresses outside of the IP ranges provided will no longer have access to the workspace.'})}</strong>)})}</>;
            saveConfirmModalProps.buttonText = formatMessage({id: 'admin.ip_filtering.apply_changes', defaultMessage: 'Yes, apply changes'});
            saveConfirmModalProps.includeDisclaimer = true;
        }

        setSaveConfirmationModal(<SaveConfirmationModal {...saveConfirmModalProps}/>);
    }

    const saveBarError = () => {
        if (currentIPIsInRange) {
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
                            setShowAddModal={setShowAddModal}
                            setEditFilter={setEditFilter}
                            handleConfirmDeleteFilter={handleConfirmDeleteFilter}
                            currentIPIsInRange={currentIPIsInRange}
                        />
                    }
                </>
            </div>
            {
                editFilter !== null &&
                <IPFilteringAddOrEditModal
                    currentIP={currentUsersIP!}
                    onClose={() => setEditFilter(null)}
                    onSave={handleEditFilter}
                    existingRange={editFilter!}
                />
            }
            {
                showAddModal &&
                <IPFilteringAddOrEditModal
                    currentIP={currentUsersIP!}
                    onClose={() => setShowAddModal(false)}
                    onSave={(filter: AllowedIPRange) => {
                        handleAddFilter(filter);
                    }}
                />
            }
            {
                filterToDelete !== null &&
                <DeleteConfirmationModal
                    onClose={() => setFilterToDelete(null)}
                    onConfirm={handleDeleteFilter}
                    filterToDelete={filterToDelete}
                />
            }
            {saveConfirmationModal}
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
