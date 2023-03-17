// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CheckIcon} from '@mattermost/compass-icons/components';
import classNames from 'classnames';

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {GlobalState} from '@mattermost/types/store';
import {getServerVersion} from 'mattermost-redux/selectors/entities/general';
import {Client4} from 'mattermost-redux/client';
import Accordion, {AccordionItemType} from 'components/common/accordion/accordion';

import {elasticsearchTest, ldapTest, testSiteURL} from '../../../actions/admin_actions';
import LoadingScreen from '../../loading_screen';
import FormattedAdminHeader from '../../widgets/admin_console/formatted_admin_header';
import {Props} from '../admin_console';

import ChipsList, {ChipsInfoType} from './chips_list';
import CtaButtons from './cta_buttons';

import useMetricsData, {DataModel, ItemStatus, UpdatesParam} from './dashboard.data';

import './dashboard.scss';
import OverallScore from './overall-score';

const AccordionItem = styled.div`
    padding: 12px;
    &:last-child {
        border-bottom: none;
    }
    h5 {
        display: inline-flex;
        align-items: center;
        font-weight: bold;
    }
`;

const successIcon = (
    <div className='success'>
        <CheckIcon
            size={20}
            color={'var(--sys-online-indicator)'}
        />
    </div>
);

const WorkspaceOptimizationDashboard = (props: Props) => {
    const [loading, setLoading] = useState(true);
    const [versionData, setVersionData] = useState<UpdatesParam['serverVersion']>({type: '', description: '', status: ItemStatus.NONE});

    // const [guestAccountStatus, setGuestAccountStatus] = useState<ItemStatus>('none');
    const [liveUrlStatus, setLiveUrlStatus] = useState<ItemStatus>(ItemStatus.ERROR);
    const [elastisearchStatus, setElasticsearchStatus] = useState<ItemStatus>(ItemStatus.INFO);
    const [ldapStatus, setLdapStatus] = useState<ItemStatus>(ItemStatus.INFO);
    const [dataRetentionStatus, setDataRetentionStatus] = useState<ItemStatus>(ItemStatus.INFO);
    const {formatMessage} = useIntl();
    const {getAccessData, getConfigurationData, getUpdatesData, getPerformanceData, getDataPrivacyData, getEaseOfManagementData, isLicensed, isEnterpriseLicense} = useMetricsData();

    // get the currently installed server version
    const installedVersion = useSelector((state: GlobalState) => getServerVersion(state));
    const analytics = useSelector((state: GlobalState) => state.entities.admin.analytics);
    const {TOTAL_USERS: totalUsers, TOTAL_POSTS: totalPosts} = analytics!;

    // gather locally available data
    const {
        ServiceSettings,
        DataRetentionSettings,
        ElasticsearchSettings,
        LdapSettings,

        // TeamSettings,
        // GuestAccountsSettings,
    } = props.config;
    const {location} = document;

    const sessionLengthWebInHours = ServiceSettings?.SessionLengthWebInHours || -1;

    const testURL = () => {
        if (!ServiceSettings?.SiteURL) {
            return Promise.resolve();
        }

        const onSuccess = ({status}: any) => setLiveUrlStatus(status === 'OK' ? ItemStatus.OK : ItemStatus.ERROR);
        const onError = () => setLiveUrlStatus(ItemStatus.ERROR);
        return testSiteURL(onSuccess, onError, ServiceSettings?.SiteURL);
    };

    const testDataRetention = async () => {
        if (!isLicensed || !isEnterpriseLicense) {
            return Promise.resolve();
        }

        if (DataRetentionSettings?.EnableMessageDeletion || DataRetentionSettings?.EnableFileDeletion) {
            setDataRetentionStatus(ItemStatus.OK);
            return Promise.resolve();
        }

        const result = await fetch(`${Client4.getBaseRoute()}/data_retention/policies?page=0&per_page=0`).then((result) => result.json());

        setDataRetentionStatus(result.total_count > 0 ? ItemStatus.OK : ItemStatus.INFO);
        return Promise.resolve();
    };

    const fetchVersion = async () => {
        const result = await fetch(`${Client4.getBaseRoute()}/latest_version`).then((result) => result.json());

        if (result.tag_name) {
            const sanitizedVersion = result.tag_name.startsWith('v') ? result.tag_name.slice(1) : result.tag_name;
            const newVersionParts = sanitizedVersion.split('.');
            const installedVersionParts = installedVersion.split('.').slice(0, 3);

            // quick general check if a newer version is available
            let type = '';
            let status: ItemStatus = ItemStatus.OK;

            if (newVersionParts.join('') > installedVersionParts.join('')) {
                // get correct values to be inserted into the accordion item
                switch (true) {
                case newVersionParts[0] > installedVersionParts[0]:
                    type = formatMessage({
                        id: 'admin.reporting.workspace_optimization.updates.server_version.update_type.major',
                        defaultMessage: 'Major',
                    });
                    status = ItemStatus.ERROR;
                    break;
                case newVersionParts[1] > installedVersionParts[1]:
                    type = formatMessage({
                        id: 'admin.reporting.workspace_optimization.updates.server_version.update_type.minor',
                        defaultMessage: 'Minor',
                    });
                    status = ItemStatus.WARNING;
                    break;
                case newVersionParts[2] > installedVersionParts[2]:
                    type = formatMessage({
                        id: 'admin.reporting.workspace_optimization.updates.server_version.update_type.patch',
                        defaultMessage: 'Patch',
                    });
                    status = ItemStatus.INFO;
                    break;
                }
            }

            setVersionData({type, description: result.body, status});
        }
    };

    const testElasticsearch = () => {
        if (!isLicensed || !isEnterpriseLicense || !(ElasticsearchSettings?.EnableIndexing && ElasticsearchSettings?.EnableSearching)) {
            return Promise.resolve();
        }

        const onSuccess = ({status}: any) => setElasticsearchStatus(status === 'OK' ? ItemStatus.OK : ItemStatus.INFO);
        const onError = () => setElasticsearchStatus(ItemStatus.INFO);

        return elasticsearchTest(props.config, onSuccess, onError);
    };

    const testLdap = () => {
        if (!isLicensed || !LdapSettings?.Enable) {
            return Promise.resolve();
        }

        const onSuccess = ({status}: any) => setLdapStatus(status === 'OK' ? ItemStatus.OK : ItemStatus.INFO);
        const onError = () => setLdapStatus(ItemStatus.INFO);

        return ldapTest(onSuccess, onError);
    };

    // commented out for now.
    // @see discussion here: https://github.com/mattermost/mattermost-webapp/pull/9822#discussion_r806879385
    // const fetchGuestAccounts = async () => {
    //     if (TeamSettings?.EnableOpenServer && GuestAccountsSettings?.Enable) {
    //         let usersArray = await fetch(`${Client4.getBaseRoute()}/users/invalid_emails`).then((result) => result.json());
    //
    //         // this setting is just a string with a list of domains, or an empty string
    //         if (GuestAccountsSettings?.RestrictCreationToDomains) {
    //             const domainList = GuestAccountsSettings?.RestrictCreationToDomains;
    //             usersArray = usersArray.filter(({email}: Record<string, unknown>) => domainList.includes((email as string).split('@')[1]));
    //         }
    //
    //         // if guest accounts make up more than 5% of the user base show the info accordion
    //         if (usersArray.length > (totalUsers as number * 0.05)) {
    //             setGuestAccountStatus(ItemStatus.INFO);
    //             return;
    //         }
    //     }
    //
    //     setGuestAccountStatus(ItemStatus.OK);
    // };

    useEffect(() => {
        const promises = [];
        promises.push(testURL());
        promises.push(testLdap());
        promises.push(fetchVersion());
        promises.push(testElasticsearch());
        promises.push(testDataRetention());

        // promises.push(fetchGuestAccounts());
        Promise.all(promises).then(() => setLoading(false));
    }, [props.config, isLicensed, isEnterpriseLicense]);

    const data: DataModel = {
        updates: getUpdatesData({serverVersion: versionData}),
        configuration: getConfigurationData({
            ssl: {status: location.protocol === 'https:' ? ItemStatus.OK : ItemStatus.ERROR},
            sessionLength: {status: sessionLengthWebInHours === 720 ? ItemStatus.INFO : ItemStatus.OK},
        }),
        access: getAccessData({siteUrl: {status: liveUrlStatus}}),
        performance: getPerformanceData({
            search: {
                status: totalPosts < 2_000_000 && totalUsers < 500 ? ItemStatus.OK : elastisearchStatus,
            },
        }),
        dataPrivacy: getDataPrivacyData({retention: {status: dataRetentionStatus}}),
        easyManagement: getEaseOfManagementData({
            ldap: {status: totalUsers < 100 ? ItemStatus.OK : ldapStatus},

            // guestAccounts: {status: guestAccountStatus},
        }),
    };

    const overallScoreChips: ChipsInfoType = {
        [ItemStatus.INFO]: 0,
        [ItemStatus.WARNING]: 0,
        [ItemStatus.ERROR]: 0,
    };

    const overallScore = {
        max: 0,
        current: 0,
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const accData: AccordionItemType[] = Object.entries(data).filter(([_, y]) => !y.hide).map(([accordionKey, accordionData]) => {
        const accordionDataChips: ChipsInfoType = {
            [ItemStatus.INFO]: 0,
            [ItemStatus.WARNING]: 0,
            [ItemStatus.ERROR]: 0,
        };
        const items: React.ReactNode[] = [];
        accordionData.items.forEach((item) => {
            if (item.status === undefined) {
                return;
            }

            // add the items impact to the overall score here
            overallScore.max += item.scoreImpact;
            overallScore.current += item.scoreImpact * item.impactModifier;

            // chips will only be displayed for info aka Success, warning and error aka Problems
            if (item.status !== ItemStatus.OK && item.status !== ItemStatus.NONE) {
                items.push((
                    <AccordionItem
                        key={`${accordionKey}-item_${item.id}`}
                    >
                        <h5>
                            <i
                                className={classNames(`icon ${item.status}`, {
                                    'icon-alert-outline': item.status === ItemStatus.WARNING,
                                    'icon-alert-circle-outline': item.status === ItemStatus.ERROR,
                                    'icon-information-outline': item.status === ItemStatus.INFO,
                                })}
                            />
                            {item.title}
                        </h5>
                        <p>{item.description}</p>
                        <CtaButtons
                            learnMoreLink={item.infoUrl}
                            learnMoreText={item.infoText}
                            actionLink={item.configUrl}
                            actionText={item.configText}
                        />
                    </AccordionItem>
                ));

                accordionDataChips[item.status] += 1;
                overallScoreChips[item.status] += 1;
            }
        });
        const {title, description, descriptionOk, icon} = accordionData;
        return {
            title,
            description: items.length === 0 ? descriptionOk : description,
            icon: items.length === 0 ? successIcon : icon,
            items,
            extraContent: (
                <ChipsList
                    chipsData={accordionDataChips}
                    hideCountZeroChips={true}
                />
            ),
        };
    });

    return loading ? <LoadingScreen/> : (
        <div className='WorkspaceOptimizationDashboard wrapper--fixed'>
            <FormattedAdminHeader
                id={'admin.reporting.workspace_optimization.title'}
                defaultMessage='Workspace Optimization'
            />
            <div className='admin-console__wrapper'>
                <OverallScore
                    chips={
                        <ChipsList
                            chipsData={overallScoreChips}
                            hideCountZeroChips={false}
                        />
                    }
                    chartValue={Math.floor((overallScore.current / overallScore.max) * 100)}
                />
                <Accordion
                    accordionItemsData={accData}
                    expandMultiple={true}
                />
            </div>
        </div>
    );
};

export default WorkspaceOptimizationDashboard;
