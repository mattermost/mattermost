import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { Button } from 'react-bootstrap';
import { AllowedIPRange } from '@mattermost/types/config';
import IPFilteringEarthSvg from 'components/common/svg_images_components/ip_filtering_earth_svg';
import { AlertOutlineIcon, PencilOutlineIcon, TrashCanOutlineIcon } from '@mattermost/compass-icons/components';
import OverlayTrigger from 'components/overlay_trigger';
import { Tooltip } from 'react-bootstrap';

type EditSectionProps = {
    ipFilters: AllowedIPRange[] | null;
    currentUsersIP: string | null;
    currentIPIsInRange: boolean;
    setShowAddModal: (show: boolean) => void;
    setEditFilter: (filter: AllowedIPRange) => void;
    handleConfirmDeleteFilter: (filter: AllowedIPRange) => void;
};

const EditSection: React.FC<EditSectionProps> = ({
    ipFilters,
    currentUsersIP,
    setShowAddModal,
    setEditFilter,
    handleConfirmDeleteFilter,
    currentIPIsInRange,
}) => {
    const { formatMessage } = useIntl();
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);

    const editTooltip = <Tooltip id="edit-tooltip">{formatMessage({ id: 'admin.ip_filtering.edit', defaultMessage: 'Edit' })}</Tooltip>;
    const deleteTooltip = <Tooltip id="delete-tooltip">{formatMessage({ id: 'admin.ip_filtering.delete', defaultMessage: 'Delete' })}</Tooltip>;

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

    function handleRowMouseEnter(index: number) {
        setHoveredRow(index);
    }

    function handleRowMouseLeave() {
        setHoveredRow(null);
    }


    return (
        <div className="EditSection">
            <div className="AllowedIPAddressesSection">
                <div className="SectionHeaderContent">
                    <div className="Frame1281">
                        <div className="TitleSubtitle">
                            <div className="Title">
                                {formatMessage({ id: 'admin.ip_filtering.allowed_ip_addresses', defaultMessage: 'Allowed IP Addresses' })}
                            </div>
                            <div className="Subtitle">
                                {formatMessage({ id: 'admin.ip_filtering.edit_section_description_line_1', defaultMessage: 'Create rules to allow access to the workspace for specified IP addresses only.' })}
                            </div>
                            <div className="Subtitle">
                                {formatMessage({ id: 'admin.ip_filtering.edit_section_description_line_2', defaultMessage: 'NOTE: If no rules are added, all IP addresses will be allowed.' })}
                            </div>
                        </div>
                        <div className="AddIPFilterButton">
                            <Button
                                className="Button"
                                onClick={() => { setShowAddModal(true); }}
                                type="button"
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
                            <div className="FilterName">
                                {formatMessage({ id: 'admin.ip_filtering.filter_name', defaultMessage: 'Filter Name' })}
                            </div>
                            <div className="IpAddressRange">
                                {formatMessage({ id: 'admin.ip_filtering.ip_address_range', defaultMessage: 'IP Address Range' })}
                            </div>
                        </div>
                        {ipFilters?.map((allowedIPRange, index) => (
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
                                            <OverlayTrigger placement='top' overlay={editTooltip}><div className="edit" aria-label="Edit" role="button" onClick={() => setEditFilter(allowedIPRange)}><PencilOutlineIcon size={20} /></div></OverlayTrigger>
                                            <OverlayTrigger placement='top' overlay={deleteTooltip}><div className="delete" aria-label="Delete" role="button" onClick={() => handleConfirmDeleteFilter(allowedIPRange)}><TrashCanOutlineIcon size={20} color="red" /></div></OverlayTrigger>
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
                            <p>
                                {formatMessage(
                                    {
                                        id: 'admin.ip_filtering.any_ip_can_access_add_filter',
                                        defaultMessage: 'Any IP can access your workspace. To limit access to selected IP Addresses, {add}.'
                                    },
                                    {
                                        add: (
                                            <Button onClick={() => setShowAddModal(true)} className="Button" type="button">
                                                {formatMessage({ id: 'admin.ip_filtering.add_filter', defaultMessage: 'add a filter' })}
                                            </Button>
                                        )
                                    }
                                )}
                            </p>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default EditSection;