// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {SupportPacketContent} from '@mattermost/types/admin';
import type {ClientLicense} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';

import ExternalLink from 'components/external_link';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {LicenseSkus} from 'utils/constants';

import supportEntitlementsData from './support_entitlements.json';

import './support_entitlements.scss';

const messages = defineMessages({
    title: {id: 'admin.support.entitlements.title', defaultMessage: 'Support Entitlements'},
});

export const searchableStrings = [
    messages.title,
];

type SupportPlan = {
    name: string;
    features: Record<string, boolean>;
    sla_response_times: Record<string, string | null>;
    notes?: string;
};

type Props = {
    license: ClientLicense;
    enterpriseReady: boolean;
    packetContents: SupportPacketContent[];
    actions: {
        getLicenseConfig: () => void;
    };
};

const SupportEntitlements: React.FC<Props> = ({
    license,
    enterpriseReady,
    packetContents,
    actions,
}) => {
    const [loading, setLoading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | undefined>();

    useEffect(() => {
        actions.getLicenseConfig();
    }, [actions]);

    const getCurrentPlan = (): SupportPlan => {
        const plans = supportEntitlementsData.plans as SupportPlan[];

        // Determine current plan based on license
        // Check if not licensed first
        if (!license || !license.IsLicensed || license.IsLicensed !== 'true') {
            return plans.find((p) => p.name === 'Free') || plans[0];
        }

        // Check if not enterprise ready (Team Edition)
        if (!enterpriseReady) {
            return plans.find((p) => p.name === 'Free') || plans[0];
        }

        // Licensed and enterprise ready - check SKU
        const skuName = license.SkuShortName;
        if (!skuName) {
            return plans.find((p) => p.name === 'Free') || plans[0];
        }

        switch (skuName) {
        case LicenseSkus.Starter:
        case LicenseSkus.Entry:
            // Starter and Entry are evaluation/limited licenses with Free support level
            return plans.find((p) => p.name === 'Free') || plans[0];
        case LicenseSkus.Professional:
            return plans.find((p) => p.name === 'Professional') || plans[1];
        case LicenseSkus.Enterprise:
            return plans.find((p) => p.name === 'Enterprise') || plans[2];
        case LicenseSkus.EnterpriseAdvanced:
            // Only Enterprise Advanced gets Premier support
            return plans.find((p) => p.name === 'Premier') || plans[3];
        default:
            return plans.find((p) => p.name === 'Free') || plans[0];
        }
    };

    const currentPlan = getCurrentPlan();
    const isFree = currentPlan.name === 'Free';

    const downloadSupportPacket = async () => {
        setLoading(true);
        setDownloadError(undefined);

        const url = new URL(Client4.getSystemRoute() + '/support_packet');
        packetContents.forEach((content) => {
            if (content.id === 'basic.server.logs') {
                url.searchParams.set('basic_server_logs', String(content.selected));
            } else if (!content.mandatory && content.selected) {
                url.searchParams.append('plugin_packets', content.id);
            }
        });

        try {
            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: {'Content-Type': 'application/zip'},
            });

            if (!res.ok) {
                const data = await res.json();
                const error = data.message + ': ' + data.detailed_error;
                setDownloadError(error);
                setLoading(false);
                return;
            }

            const blob = await res.blob();
            setLoading(false);

            const href = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = href;

            const contentDisposition = res.headers.get('content-disposition');
            const filename = extractFilename(contentDisposition);
            link.setAttribute('download', filename);

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            setDownloadError('Failed to download support packet');
            setLoading(false);
        }
    };

    const extractFilename = (contentDisposition: string | null): string => {
        if (!contentDisposition) {
            return 'mm_support_packet.zip';
        }

        const regex = /filename\*?=["']?((?:\\.|[^"'\s])+)(?=["']?)/g;
        const matches = regex.exec(contentDisposition);
        return matches ? matches[1] : 'mm_support_packet.zip';
    };

    const renderFeatureTable = () => {
        const featureLabels: Record<string, string> = {
            self_help_resources: 'Self-help resources',
            community_support: 'Community support',
            online_ticket_creation: 'Online ticket creation',
            regional_business_day_coverage: 'Regional business day coverage',
            '12x5_business_hours_coverage': '12x5 business hours coverage',
            '24x7_weekend_coverage': '24x7 weekend coverage',
            direct_access_senior_support_team: 'Direct access to senior support team',
            screen_sharing_collab_phone_calls: 'Screen sharing & collaboration phone calls',
            private_discussion_channel_with_technical_staff: 'Private discussion channel with technical staff',
            additional_license_entitlements_non_production: 'Additional license entitlements for non-production',
        };

        return (
            <div className='support-features-table'>
                <h3>
                    <FormattedMessage
                        id='admin.support.entitlements.features.title'
                        defaultMessage='Your Support Features'
                    />
                </h3>
                <table>
                    <tbody>
                        {Object.entries(currentPlan.features).map(([key, enabled]) => (
                            <tr key={key}>
                                <td className='feature-name'>{featureLabels[key] || key}</td>
                                <td className='feature-value'>
                                    {enabled ? (
                                        <i className='icon icon-check text-success'/>
                                    ) : (
                                        <i className='icon icon-close text-muted'/>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className='wrapper--fixed SupportEntitlements'>
            <AdminHeader>
                <FormattedMessage {...messages.title}/>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {isFree && (
                        <div className='admin-console__banner_section'>
                            <div className='support-upsell-banner'>
                                <div className='upsell-content'>
                                    <h4>
                                        <FormattedMessage
                                            id='admin.support.entitlements.upsell.title'
                                            defaultMessage='Upgrade for Enhanced Support'
                                        />
                                    </h4>
                                    <p>
                                        <FormattedMessage
                                            id='admin.support.entitlements.upsell.description'
                                            defaultMessage='Get faster response times, direct access to support engineers, and additional support features by upgrading to Professional, Enterprise, or Premier.'
                                        />
                                    </p>
                                    <ExternalLink
                                        href='https://mattermost.com/pricing'
                                        location='support_entitlements'
                                        className='btn btn-primary'
                                    >
                                        <FormattedMessage
                                            id='admin.support.entitlements.upsell.button'
                                            defaultMessage='View Plans'
                                        />
                                    </ExternalLink>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className='top-wrapper'>
                        <div className='left-panel'>
                            <div className='panel-card'>
                                <div className='current-plan-legend'>
                                    <i className='icon icon-check-circle'/>
                                    <FormattedMessage
                                        id='admin.support.entitlements.current_plan'
                                        defaultMessage='Current Plan: {plan}'
                                        values={{plan: currentPlan.name}}
                                    />
                                </div>

                                {renderFeatureTable()}
                            </div>
                        </div>

                        <div className='right-panel'>
                            <div className='panel-card'>
                                <div className='support-actions'>
                                    <h3>
                                        <FormattedMessage
                                            id='admin.support.entitlements.actions.title'
                                            defaultMessage='Support Resources'
                                        />
                                    </h3>

                                    <div className='support-action-buttons'>
                                        <button
                                            className='btn btn-primary'
                                            onClick={downloadSupportPacket}
                                            disabled={loading}
                                        >
                                            {loading ? <LoadingSpinner/> : <i className='icon icon-download-outline'/>}
                                            {' '}
                                            <FormattedMessage
                                                id='admin.support.entitlements.download_packet'
                                                defaultMessage='Download Support Packet'
                                            />
                                        </button>

                                        <ExternalLink
                                            href='https://support.mattermost.com/hc/en-us'
                                            location='support_entitlements'
                                            className='btn btn-secondary'
                                        >
                                            <i className='icon icon-book-open-variant'/>
                                            {' '}
                                            <FormattedMessage
                                                id='admin.support.entitlements.knowledge_base'
                                                defaultMessage='Visit Knowledge Base'
                                            />
                                        </ExternalLink>
                                    </div>

                                    {downloadError && (
                                        <div className='support-error'>
                                            <i className='icon icon-alert-outline'/>
                                            {' '}
                                            {downloadError}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportEntitlements;
