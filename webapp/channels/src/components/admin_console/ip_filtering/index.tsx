import React, { useEffect, useState } from 'react';
import { AllowedIPRange, FetchIPResponse } from '@mattermost/types/config';

import './ip_filtering.scss';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import SaveChangesPanel from '../team_channel_settings/save_changes_panel';
import { Button } from 'react-bootstrap';
import OverlayTrigger from 'components/overlay_trigger';
import IPFilteringAddOrEditModal from './add_edit_ip_filter_modal';
import { AlertOutlineIcon, PencilOutlineIcon, TrashCanOutlineIcon } from '@mattermost/compass-icons/components';
import Tooltip from 'components/tooltip';
import { useIntl } from 'react-intl';
import { Client4 } from 'mattermost-redux/client';
import DeleteConfirmationModal from './delete_confirmation';
import Toggle from 'components/toggle';
import IPFilteringEarthSvg from 'components/common/svg_images_components/ip_filtering_earth_svg';
import SaveConfirmationModal from './save_confirmation_modal';
import { isIPAddressInRanges } from './ip_filtering_utils';

const IPFiltering = () => {
    const { formatMessage } = useIntl();
    const [showAddModal, setShowAddModal] = useState(false);
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);
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
        })

        Client4.getCurrentIP().then((res) => {
            setCurrentUsersIP((res as FetchIPResponse)?.IP);
        })
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
    }, [ipFilters, currentUsersIP, filterToggle])

    useEffect(() => {
        if (!ipFilters?.length) {
            return;
        }
        setFilterToggle(ipFilters?.some((filter: AllowedIPRange) => filter.Enabled === true) ?? false);
    }, [ipFilters])

    useEffect(() => {
        if (filterToggle === false) {
            setIpFilters(ipFilters?.map((filter: AllowedIPRange): AllowedIPRange => {
                return {
                    ...filter,
                    Enabled: false,
                }
            }) || [])
        } else {
            setIpFilters(ipFilters?.map((filter: AllowedIPRange): AllowedIPRange => {
                return {
                    ...filter,
                    Enabled: true,
                }
            }) || [])
        }
    }, [filterToggle])

    function handleRowMouseEnter(index: number) {
        setHoveredRow(index);
    }

    function handleRowMouseLeave() {
        setHoveredRow(null);
    }

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
    }

    function handleSave() {
        console.log(ipFilters);
        setSaving(true);
        setSaveConfirmationModal(null);

        Client4.applyIPFilters(ipFilters ?? []).then((res) => {
            console.log(res);
            setIpFilters(res as AllowedIPRange[]);
            setSaveNeeded(false);
            setSaving(false);
        });
    }

    function handleSaveClick() {
        let saveConfirmModalProps = {
            onClose: () => { setSaveConfirmationModal(null); },
            onConfirm: handleSave,
        } as any;
        if (!ipFilters?.length && filterToggle) {
            saveConfirmModalProps.title = formatMessage({ id: 'admin.ip_filtering.apply_ip_filter_changes', defaultMessage: 'Apply IP Filter Changes' });
            saveConfirmModalProps.subtitle = <>{formatMessage({ id: 'admin.ip_filtering.no_filters_added', defaultMessage: 'Are you sure you want to apply these IP filter changes? There are currently no filters added, so {strong}' }, { strong: (<strong>{formatMessage({ id: 'admin.ip_filtering.all_ip_addresses_will_have_access', defaultMessage: 'All IP addresses will have access to the workspace.' })}</strong>) })}</>;
            saveConfirmModalProps.buttonText = formatMessage({ id: 'admin.ip_filtering.apply_changes', defaultMessage: 'Yes, apply Changes' });
            saveConfirmModalProps.includeDisclaimer = false;
        } else if (!filterToggle) {
            saveConfirmModalProps.title = formatMessage({ id: 'admin.ip_filtering.disable_ip_filtering', defaultMessage: 'Disable IP Filtering' });
            saveConfirmModalProps.subtitle = <>{formatMessage({ id: 'admin.ip_filtering.turn_off_ip_filtering', defaultMessage: 'Are you sure you want to turn off IP Filtering? {strong}' }, { strong: (<strong>{formatMessage({ id: 'admin.ip_filtering.all_ip_addresses_will_have_access', defaultMessage: 'All IP addresses will have access to the workspace.' })}</strong>) })}</>;
            saveConfirmModalProps.buttonText = formatMessage({ id: 'admin.ip_filtering.disable_ip_filtering', defaultMessage: 'Yes, disable IP Filtering' });
            saveConfirmModalProps.includeDisclaimer = false;
        } else {
            saveConfirmModalProps.title = formatMessage({ id: 'admin.ip_filtering.apply_ip_filter_changes', defaultMessage: 'Apply IP Filter Changes' });
            saveConfirmModalProps.subtitle = <>{formatMessage({ id: 'admin.ip_filtering.apply_ip_filter_changes', defaultMessage: 'Are you sure you want to apply these IP Filter changes? {strong}' }, { strong: (<strong>{formatMessage({ id: 'admin.ip_filtering.users_with_ip_addresses_outside_ip_ranges', defaultMessage: 'Users with IP addresses outside of the IP ranges provided will no longer have access to the workspace.' })}</strong>) })}</>;
            saveConfirmModalProps.buttonText = formatMessage({ id: 'admin.ip_filtering.apply_changes', defaultMessage: 'Yes, apply Changes' });
            saveConfirmModalProps.includeDisclaimer = true;
        }

        setSaveConfirmationModal(<SaveConfirmationModal {...saveConfirmModalProps} />);
    }

    const editTooltip = (
        <Tooltip id="editToolTip">
            {formatMessage({ id: 'admin.ip_filtering.edit_filter', defaultMessage: 'Edit filter' })}
        </Tooltip>
    );

    const deleteTooltip = (
        <Tooltip id="deleteToolTip">
            {formatMessage({ id: 'admin.ip_filtering.delete_filter', defaultMessage: 'Delete filter' })}
        </Tooltip>
    )

    const saveBarError = () => {
        if (currentIPIsInRange) {
            return undefined;
        }

        return (
            <>
                <AlertOutlineIcon size={16} /> {formatMessage({ id: 'admin.ip_filtering.error_on_page', defaultMessage: 'There are errors on this page' })}
            </>
        )
    }

    const ipNotInRangeErrorPanel = (
        <div className="NotInRangeErrorPanel">
            <div className="Icon">
                <AlertOutlineIcon size={20} />
            </div>
            <div className="Content">
                <div className="Title">
                    {formatMessage({ id: 'admin.ip_filtering.your_current_ip_is_not_in_allowed_rules', defaultMessage: 'Your IP address {ip} is not included in your allowed IP address rules.' }, { ip: currentUsersIP })}
                </div>
                <div className="Body">
                    {formatMessage({ id: 'admin.ip_filtering.include_your_ip', defaultMessage: 'Include your IP address in at least one of the rules below to continue.' })}
                </div>
                <Button
                    className="Button"
                    onClick={() => { setShowAddModal(true); }}
                >
                    {formatMessage({ id: 'admin.ip_filtering.add_your_ip', defaultMessage: 'Add your IP address' })}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="IPFiltering wrapper--fixed">
            <AdminHeader>
                {formatMessage({ id: 'admin.ip_filtering.ip_filtering', defaultMessage: 'IP Filtering' })}
            </AdminHeader>
            <div className='MainPanel admin-console__wrapper'>
                <>
                    <div className="EnableSectionContent">
                        <div className="Frame1281">
                            <div className="TitleSubtitle">
                                <div className="Frame1286">
                                    <div className="Title">
                                        {formatMessage({ id: 'admin.ip_filtering.enable_ip_filtering', defaultMessage: 'Enable IP Filtering' })}</div>
                                    <div className="Subtitle">{formatMessage({ id: 'admin.ip_filtering.enable_ip_filtering_description', defaultMessage: 'Enable IP Filtering to limit access to your workspace by IP addresses.' })}</div>
                                </div>
                            </div>
                            <div className="SwitchSelector">
                                <Toggle
                                    size={'btn-md'}
                                    disabled={false}
                                    onToggle={() => setFilterToggle(!filterToggle)}
                                    toggled={filterToggle}
                                    toggleClassName='btn-toggle-primary'
                                />
                            </div>
                        </div>
                    </div>
                    {ipFilters !== null && currentUsersIP !== null && filterToggle &&
                        <div className="EditSection">
                            <div className="AllowedIPAddressesSection">
                                <div className="SectionHeaderContent">
                                    <div className="Frame1281">
                                        <div className="TitleSubtitle">
                                            <div className="Title">{formatMessage({ id: 'admin.ip_filtering.allowed_ip_addresses', defaultMessage: 'Allowed IP Addresses' })}</div>
                                            <div className="Subtitle">{formatMessage({id: 'admin.ip_filtering.edit_section_description_line_1', defaultMessage: 'Create rules to allow access to the workspace for specified IP addresses only.'})}</div>
                                            <div className="Subtitle">{formatMessage({id: 'admin.ip_filtering.edit_section_description_line_2', defaultMessage: 'NOTE: If no rules are added, all IP addresses will be allowed.'})}</div>
                                        </div>
                                        <div className="AddIPFilterButton">
                                            <Button
                                                className="Button"
                                                onClick={() => { setShowAddModal(true); }}
                                                type="primary"
                                            >
                                                {formatMessage({ id: 'admin.ip_filtering.add_filter', defaultMessage: 'Add Filter' })}
                                            </Button>
                                        </div>
                                    </div>
                                    {!currentIPIsInRange && (ipNotInRangeErrorPanel)}
                                </div>
                            </div>
                            {Boolean(ipFilters?.length) &&
                                <div className="TableSectionContent">
                                    <div className="Table">
                                        <div className="HeaderRow">
                                            <div className="FilterName">{formatMessage({ id: 'admin.ip_filtering.filter_name', defaultMessage: 'Filter Name' })}</div>
                                            <div className="IpAddressRange">{formatMessage({ id: 'admin.ip_filtering.ip_address_range', defaultMessage: 'IP Address Range' })}</div>
                                        </div>
                                        {ipFilters.map((allowedIPRange, index) => (
                                            <div
                                                className="Row"
                                                key={allowedIPRange.CIDRBlock}
                                                onMouseEnter={() => handleRowMouseEnter(index)}
                                                onMouseLeave={handleRowMouseLeave}
                                            >
                                                <div className="FilterName">{allowedIPRange.Description}</div>
                                                <div className="IpAddressRange">{allowedIPRange.CIDRBlock}</div>
                                                <div className="Actions">
                                                    {hoveredRow === index && (
                                                        <>
                                                            <OverlayTrigger placement='top' overlay={editTooltip}><div className="edit" onClick={() => setEditFilter(allowedIPRange)}><PencilOutlineIcon size={20} /></div></OverlayTrigger>
                                                            <OverlayTrigger placement='top' overlay={deleteTooltip}><div className="delete" onClick={() => handleConfirmDeleteFilter(allowedIPRange)}><TrashCanOutlineIcon size={20} color="red" /></div></OverlayTrigger>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            }
                            {
                                ipFilters?.length === 0 && (
                                    <div className="NoFilters">
                                        <div className="icon">
                                            <IPFilteringEarthSvg width={149} height={140} />
                                        </div>
                                        <div className="Title">
                                            {formatMessage({ id: 'admin.ip_filtering.no_filters', defaultMessage: 'No IP filtering rules added' })}
                                        </div>
                                        <div className="Subtitle">
                                            <p>{formatMessage({ id: 'admin.ip_filtering.any_ip_can_access_add_filter', defaultMessage: 'Any IP can access your workspace. To limit access to selected IP Addresses, {add}.' }, { add: (<Button onClick={() => setShowAddModal(true)} className="Button" type="link">{formatMessage({ id: 'admin.ip_filtering.add_filter', defaultMessage: 'add a filter' })}</Button>) })}</p>
                                        </div>
                                    </div>
                                )
                            }
                        </div>
                    }
                </>
            </div>
            {editFilter !== null && <IPFilteringAddOrEditModal currentIP={currentUsersIP!} onClose={() => setEditFilter(null)} onSave={handleEditFilter} existingRange={editFilter!} />}
            {showAddModal && <IPFilteringAddOrEditModal currentIP={currentUsersIP!} onClose={() => setShowAddModal(false)} onSave={(filter: AllowedIPRange) => { handleAddFilter(filter) }} />}
            {filterToDelete !== null && <DeleteConfirmationModal onClose={() => setFilterToDelete(null)} onConfirm={handleDeleteFilter} filterToDelete={filterToDelete} />}
            {saveConfirmationModal}
            <SaveChangesPanel
                saving={saving}
                saveNeeded={saveNeeded}
                isDisabled={!currentIPIsInRange}
                onClick={handleSaveClick}
                serverError={saveBarError()}
                cancelLink="/admin_console/site_config/ip_filtering"
            />
        </div>
    );
};

export default IPFiltering;