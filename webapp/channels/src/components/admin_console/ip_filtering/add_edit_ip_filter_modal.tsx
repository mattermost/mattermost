// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cidrRegex from 'cidr-regex';
import React, {useState} from 'react';
import {Modal} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';
import type {AllowedIPRange} from '@mattermost/types/config';

import ExternalLink from 'components/external_link';
import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';
import Input from 'components/widgets/inputs/input/input';

import './add_edit_ip_filter_modal.scss';

type Props = {
    onClose: () => void;
    onSave: (allowedIPRange: AllowedIPRange, oldIPRange?: AllowedIPRange) => void;
    existingRange?: AllowedIPRange;
    currentIP?: string;
}

function validateCIDR(cidr: string) {
    return cidrRegex.v4({exact: true}).test(cidr) || cidrRegex.v6({exact: true}).test(cidr);
}

export default function IPFilteringAddOrEditModal({onClose, onSave, existingRange, currentIP}: Props) {
    const {formatMessage} = useIntl();
    const [name, setName] = useState(existingRange?.Description || '');
    const [CIDR, setCIDR] = useState(existingRange?.CIDRBlock || '');

    const [CIDRError, setCIDRError] = useState<CustomMessageInputType>(null);

    const handleSave = () => {
        const allowedIPRange: AllowedIPRange = {
            CIDRBlock: CIDR,
            Description: name,
            Enabled: true,
            OwnerID: '',
        };

        if (existingRange) {
            onSave(allowedIPRange, existingRange);
        } else {
            onSave(allowedIPRange);
        }

        onClose();
    };

    const handleCIDRChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const cidr = e.target.value;
        setCIDR(cidr);
        setCIDRError(null);
    };

    const validateCIDRInput = () => {
        if (!validateCIDR(CIDR)) {
            setCIDRError({type: 'error', value: 'Invalid CIDR address range'});
        }
    };

    return (
        <Modal
            className={'IPFilteringAddOrEditModal'}
            dialogClassName={'IPFilteringAddOrEditModal__dialog'}
            show={true}
            onExited={onClose}
            onHide={onClose}
        >
            <Modal.Header closeButton={true}>
                <div className='title'>
                    {existingRange?.CIDRBlock ? formatMessage({id: 'admin.ip_filtering.edit_ip_filter', defaultMessage: 'Edit IP Filter'}) : formatMessage({id: 'admin.ip_filtering.add_ip_filter', defaultMessage: 'Add IP Filter'})}
                </div>
            </Modal.Header>
            <Modal.Body>
                <div className='body'>
                    <div className='current_ip_notice'>
                        <div className='Content'>
                            <span><InformationOutlineIcon/>{formatMessage({id: 'admin.ip_filtering.your_current_ip_is', defaultMessage: 'Your current IP address is {ip}'}, {ip: currentIP})}</span>
                        </div>
                    </div>
                    <div className='inputs'>
                        <div>
                            {formatMessage({id: 'admin.ip_filtering.name', defaultMessage: 'Name'})}
                            <Input
                                type='text'
                                name='name'
                                onChange={(e) => setName(e.target.value)}
                                value={name}
                                placeholder={formatMessage({id: 'admin.ip_filtering.rule_name_placeholder', defaultMessage: 'Enter a name for this rule'})}
                                required={true}
                                useLegend={false}
                            />
                        </div>
                        <div>{formatMessage({id: 'admin.ip_filtering.allow_following_range', defaultMessage: 'Allow the following range of IP Addresses'})}
                            <Input
                                type='text'
                                name='ip_address_range'
                                onChange={handleCIDRChange}
                                onBlur={validateCIDRInput}
                                value={CIDR}
                                placeholder={'Enter IP Range'}
                                required={true}
                                useLegend={false}
                                customMessage={CIDRError}
                            />
                        </div>
                        {/* TODO: get proper PL for more info link out */}
                        <p>
                            {
                                formatMessage(
                                    {
                                        id: 'admin.ip_filtering.more_info',
                                        defaultMessage: 'Enter ranges in CIDR format (e.g. 192.168.0.1/8). {link}',
                                    },
                                    {
                                        link: (
                                            <ExternalLink
                                                href='https://docs.mattermost.com/guides/cloud-workspace-management.html'
                                                location={'ip_filtering_add_edit_rule_modal'}
                                            >
                                                {formatMessage({id: 'admin.ip_filtering.more_info_link', defaultMessage: 'More info'})}
                                            </ExternalLink>
                                        ),
                                    },
                                )
                            }
                        </p>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    type='button'
                    className='btn-cancel'
                    onClick={onClose}
                >
                    {formatMessage({id: 'admin.ip_filtering.cancel', defaultMessage: 'Cancel'})}
                </button>
                <button
                    data-testid='save-add-edit-button'
                    type='button'
                    className='btn-save'
                    onClick={handleSave}
                    disabled={Boolean(CIDRError) || !CIDR.length || !name.length}
                >
                    {existingRange ? formatMessage({id: 'admin.ip_filtering.update_filter', defaultMessage: 'Update filter'}) : formatMessage({id: 'admin.ip_filtering.save', defaultMessage: 'Save'})}
                </button>
            </Modal.Footer>
        </Modal>
    );
}
