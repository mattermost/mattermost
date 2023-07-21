// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import ExternalLink from 'components/external_link';
import Menu from 'components/widgets/menu/menu';
import RestrictedIndicator from 'components/widgets/menu/menu_items/restricted_indicator';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {useLicenseChecks} from '../hooks';
import {FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS} from 'utils/cloud_utils';
import {InsightsScopes, LicenseSkus, MattermostFeatures} from 'utils/constants';
import * as Utils from 'utils/utils';

type Props = {
    filterType: string;
    setFilterTypeTeam: () => void;
    setFilterTypeMy: () => void;
}

const InsightsTitle = (props: Props) => {
    const {formatMessage} = useIntl();

    const {isStarterFree, isFreeTrial, isEnterpriseReady} = useLicenseChecks();

    const title = useCallback(() => {
        if (props.filterType === InsightsScopes.TEAM) {
            return (
                formatMessage({
                    id: 'insights.teamHeading',
                    defaultMessage: 'Team insights',
                })
            );
        }
        return (
            formatMessage({
                id: 'insights.myHeading',
                defaultMessage: 'My insights',
            })
        );
    }, [props.filterType]);

    const openInsightsDoc = useCallback(() => {
        trackEvent('insights', 'open_insights_doc');
    }, []);

    const openTeamInsightsDoc = useCallback(() => {
        trackEvent('insights', 'open_team_insights_doc');
    }, []);

    const openContactSales = useCallback(() => {
        trackEvent('insights', 'open_contact_sales_from_insights');
    }, []);

    if (!isEnterpriseReady) {
        return (
            <div className='insights-title'>
                {title()}
            </div>
        );
    }

    return (
        <MenuWrapper id='insightsFilterDropdown'>
            <button className='insights-title'>
                {title()}
                <span className='icon'>
                    <i className='icon icon-chevron-down'/>
                </span>
            </button>
            <Menu
                ariaLabel={Utils.localizeMessage('insights.filter.ariaLabel', 'Insights Filter Menu')}
            >
                <Menu.ItemAction
                    id='insightsDropdownMy'
                    buttonClass='insights-filter-btn'
                    onClick={props.setFilterTypeMy}
                    icon={
                        <span className='icon'>
                            <i className='icon icon-account-outline'/>
                        </span>
                    }
                    text={Utils.localizeMessage('insights.filter.myInsights', 'My insights')}
                />
                <Menu.ItemAction
                    id='insightsDropdownTeam'
                    buttonClass={'insights-filter-btn'}
                    onClick={props.setFilterTypeTeam}
                    icon={
                        <span className='icon'>
                            <i className='icon icon-account-multiple-outline'/>
                        </span>
                    }
                    text={Utils.localizeMessage('insights.filter.teamInsights', 'Team insights')}
                    disabled={isStarterFree}
                    sibling={(isStarterFree || isFreeTrial) && (
                        <RestrictedIndicator
                            blocked={isStarterFree}
                            feature={MattermostFeatures.TEAM_INSIGHTS}
                            minimumPlanRequiredForFeature={LicenseSkus.Professional}
                            tooltipMessage={formatMessage({
                                id: 'insights.accessModal.cloudFreeTrial',
                                defaultMessage: 'During your trial you are able to view Team Insights.',
                            })}
                            titleAdminPreTrial={formatMessage({
                                id: 'insights.accessModal.titleAdminPreTrial',
                                defaultMessage: 'Try team insights with a free trial',
                            })}
                            messageAdminPreTrial={formatMessage({
                                id: 'insights.accessModal.messageAdminPreTrial',
                                defaultMessage: 'Use {teamInsights} with one of our paid plans. Get the full experience of Enterprise when you start a free, {trialLength} day trial.',
                            },
                            {
                                trialLength: FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS,
                                teamInsights: (
                                    <ExternalLink
                                        location='insights_title'
                                        onClick={openTeamInsightsDoc}
                                        href={'https://docs.mattermost.com/welcome/insights.html#team-insights'}
                                    >
                                        <FormattedMessage
                                            id='insights.accessModal.teamDocsLink'
                                            defaultMessage='Team Insights'
                                        />
                                    </ExternalLink>
                                ),
                            },
                            )}
                            titleAdminPostTrial={formatMessage({
                                id: 'insights.accessModal.titleAdminPostTrial',
                                defaultMessage: 'Upgrade to access team insights',
                            })}
                            messageAdminPostTrial={
                                formatMessage(
                                    {
                                        id: 'insights.accessModal.messageAdminPostTrial',
                                        defaultMessage: 'To access your complete {insightsDoc} dashboard, including {teamInsights}, please upgrade your plan to Professional or Enterprise. For questions on upgrading your plan, please {contactSales} for support.',
                                    },
                                    {
                                        insightsDoc: (
                                            <ExternalLink
                                                onClick={openInsightsDoc}
                                                location='insights_title'
                                                href={'https://docs.mattermost.com/welcome/insights.html'}
                                            >
                                                <FormattedMessage
                                                    id='insights.accessModal.docsLink'
                                                    defaultMessage='Insights'
                                                />
                                            </ExternalLink>
                                        ),
                                        teamInsights: (
                                            <ExternalLink
                                                onClick={openTeamInsightsDoc}
                                                location='insights_title'
                                                href={'https://docs.mattermost.com/welcome/insights.html#team-insights'}
                                            >
                                                <FormattedMessage
                                                    id='insights.accessModal.teamDocsLink'
                                                    defaultMessage='Team Insights'
                                                />
                                            </ExternalLink>
                                        ),
                                        contactSales: (
                                            <ExternalLink
                                                onClick={openContactSales}
                                                href={'https://mattermost.com/contact-sales/'}
                                                location='insights_title'
                                            >
                                                <FormattedMessage
                                                    id='insights.accessModal.contactSales'
                                                    defaultMessage='contact our Sales team'
                                                />
                                            </ExternalLink>
                                        ),
                                    },
                                )}
                            titleEndUser={formatMessage({
                                id: 'insights.accessModal.titleEndUser',
                                defaultMessage: 'Team insights are available in paid plans',
                            })}
                            messageEndUser={
                                formatMessage(
                                    {
                                        id: 'insights.accessModal.messageEndUser',
                                        defaultMessage: 'To access your complete {insightsDoc} dashboard, including {teamInsights}, please notify your Admin to upgrade your plan to Professional or Enterprise. For questions on upgrading your plan, please {contactSales} for support.',
                                    },
                                    {
                                        insightsDoc: (
                                            <ExternalLink
                                                onClick={openInsightsDoc}
                                                href={'https://docs.mattermost.com/welcome/insights.html'}
                                                location='insights_title'
                                            >
                                                <FormattedMessage
                                                    id='insights.accessModal.docsLink'
                                                    defaultMessage='Insights'
                                                />
                                            </ExternalLink>
                                        ),
                                        teamInsights: (
                                            <ExternalLink
                                                onClick={openTeamInsightsDoc}
                                                href={'https://docs.mattermost.com/welcome/insights.html#team-insights'}
                                                location='insights_title'
                                            >
                                                <FormattedMessage
                                                    id='insights.accessModal.teamDocsLink'
                                                    defaultMessage='Team Insights'
                                                />
                                            </ExternalLink>
                                        ),
                                        contactSales: (
                                            <ExternalLink
                                                onClick={openContactSales}
                                                href={'https://mattermost.com/contact-sales/'}
                                                location='insights_title'
                                            >
                                                <FormattedMessage
                                                    id='insights.accessModal.contactSales'
                                                    defaultMessage='contact our Sales team'
                                                />
                                            </ExternalLink>
                                        ),
                                    },
                                )
                            }
                        />
                    )}
                />
            </Menu>
        </MenuWrapper>
    );
};

export default memo(InsightsTitle);
