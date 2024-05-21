// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {createRef} from 'react';
import type {RefObject} from 'react';
import type {WrappedComponentProps} from 'react-intl';
import {FormattedMessage, defineMessages, injectIntl} from 'react-intl';
import ReactSelect from 'react-select';

import type {AdminConfig} from '@mattermost/types/config';
import type {DataRetentionCustomPolicies, DataRetentionCustomPolicy} from '@mattermost/types/data_retention';
import type {JobTypeBase, JobType} from '@mattermost/types/jobs';
import type {DeepPartial} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import type {Row, Column} from 'components/admin_console/data_grid/data_grid';
import JobsTable from 'components/admin_console/jobs';
import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {getHistory} from 'utils/browser_history';
import {JobTypes} from 'utils/constants';

import './data_retention_settings.scss';

type OptionType = {
    label: string | JSX.Element;
    value: string;
}

type Props = {
    config: DeepPartial<AdminConfig>;
    customPolicies: DataRetentionCustomPolicies;
    customPoliciesCount: number;
    globalMessageRetentionHours: string | undefined;
    globalFileRetentionHours: string | undefined;
    actions: {
        getDataRetentionCustomPolicies: (page: number) => Promise<ActionResult>;
        createJob: (job: JobTypeBase) => Promise<ActionResult>;
        getJobsByType: (job: JobType) => Promise<ActionResult>;
        deleteDataRetentionCustomPolicy: (id: string) => Promise<ActionResult>;
        patchConfig: (config: DeepPartial<AdminConfig>) => Promise<ActionResult>;
    };
} & WrappedComponentProps;

type State = {
    customPoliciesLoading: boolean;
    page: number;
    loading: boolean;
    showEditJobTime: boolean;
}
const PAGE_SIZE = 10;

const messages = defineMessages({
    createJob_title: {id: 'admin.data_retention.createJob.title', defaultMessage: 'Run Deletion Job Now'},
    settings_title: {id: 'admin.data_retention.settings.title', defaultMessage: 'Data Retention Policies'},
    globalPolicy_title: {id: 'admin.data_retention.globalPolicy.title', defaultMessage: 'Global retention policy'},
    globalPolicy_subTitle: {id: 'admin.data_retention.globalPolicy.subTitle', defaultMessage: 'Keep messages and files for a set amount of time.'},
    customPolicies_title: {id: 'admin.data_retention.customPolicies.title', defaultMessage: 'Custom retention policies'},
    customPolicies_subTitle: {id: 'admin.data_retention.customPolicies.subTitle', defaultMessage: 'Customize how long specific teams and channels will keep messages.'},
    jobCreation_title: {id: 'admin.data_retention.jobCreation.title', defaultMessage: 'Policy log'},
    jobCreation_subTitle: {id: 'admin.data_retention.jobCreation.subTitle', defaultMessage: 'Daily log of messages and files removed based on the policies defined above.'},
    createJob_instructions: {id: 'admin.data_retention.createJob.instructions', defaultMessage: 'Daily time to check policies and run delete job:'},
});

export const searchableStrings = [
    messages.createJob_title,
    messages.settings_title,
    messages.globalPolicy_title,
    messages.globalPolicy_subTitle,
    messages.customPolicies_title,
    messages.customPolicies_subTitle,
    messages.jobCreation_title,
    messages.jobCreation_subTitle,
    messages.createJob_instructions,
];

class DataRetentionSettings extends React.PureComponent<Props, State> {
    inputRef: RefObject<ReactSelect<OptionType>>;
    constructor(props: Props) {
        super(props);
        this.inputRef = createRef();
        this.state = {
            customPoliciesLoading: true,
            page: 0,
            loading: false,
            showEditJobTime: false,
        };
    }
    deleteCustomPolicy = async (id: string) => {
        await this.props.actions.deleteDataRetentionCustomPolicy(id);
        this.loadPage(0);
    };

    getGlobalPolicyColumns = (): Column[] => {
        const columns: Column[] = [
            {
                name: (
                    <FormattedMessage
                        id='admin.data_retention.globalPoliciesTable.description'
                        defaultMessage='Description'
                    />
                ),
                field: 'description',
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.data_retention.globalPoliciesTable.channelMessages'
                        defaultMessage='Channel messages'
                    />
                ),
                field: 'channel_messages',
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.data_retention.globalPoliciesTable.files'
                        defaultMessage='Files'
                    />
                ),
                field: 'files',
            },
        ];
        columns.push(
            {
                name: '',
                field: 'actions',
                className: 'actionIcon',
            },
        );
        return columns;
    };
    getCustomPolicyColumns = (): Column[] => {
        const columns: Column[] = [
            {
                name: (
                    <FormattedMessage
                        id='admin.data_retention.customPoliciesTable.description'
                        defaultMessage='Description'
                    />
                ),
                field: 'description',
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.data_retention.customPoliciesTable.channelMessages'
                        defaultMessage='Channel messages'
                    />
                ),
                field: 'channel_messages',
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.data_retention.customPoliciesTable.appliedTo'
                        defaultMessage='Applied to'
                    />
                ),
                field: 'applied_to',
            },
            {
                name: '',
                field: 'actions',
                className: 'actionIcon',
            },
        ];
        return columns;
    };

    getGlobalRetentionSetting = (enabled: boolean | undefined, hours: string | undefined): JSX.Element => {
        if (!enabled) {
            return (
                <FormattedMessage
                    id='admin.data_retention.form.keepForever'
                    defaultMessage='Keep forever'
                />
            );
        }
        const hoursInt = parseInt(hours || '', 10);
        if (hoursInt && hoursInt % 8760 === 0) {
            const years = hoursInt / 8760;
            return (
                <FormattedMessage
                    id='admin.data_retention.retention_years'
                    defaultMessage='{count} {count, plural, one {year} other {years}}'
                    values={{
                        count: `${years}`,
                    }}
                />
            );
        }
        if (hoursInt && hoursInt % 24 === 0) {
            const days = hoursInt / 24;
            return (
                <FormattedMessage
                    id='admin.data_retention.retention_days'
                    defaultMessage='{count} {count, plural, one {day} other {days}}'
                    values={{
                        count: `${days}`,
                    }}
                />
            );
        }

        return (
            <FormattedMessage
                id='admin.data_retention.retention_hours'
                defaultMessage='{count} {count, plural, one {hour} other {hours}}'
                values={{
                    count: `${hours}`,
                }}
            />
        );
    };
    getMessageRetentionSetting = (enabled: boolean | undefined, days: number | undefined): JSX.Element => {
        if (!enabled) {
            return (
                <FormattedMessage
                    id='admin.data_retention.form.keepForever'
                    defaultMessage='Keep forever'
                />
            );
        }
        if (days && days % 365 === 0) {
            const years = days / 365;
            return (
                <FormattedMessage
                    id='admin.data_retention.retention_years'
                    defaultMessage='{count} {count, plural, one {year} other {years}}'
                    values={{
                        count: `${years}`,
                    }}
                />
            );
        }
        return (
            <FormattedMessage
                id='admin.data_retention.retention_days'
                defaultMessage='{count} {count, plural, one {day} other {days}}'
                values={{
                    count: `${days}`,
                }}
            />
        );
    };
    getGlobalPolicyRows = (): Row[] => {
        const {DataRetentionSettings} = this.props.config;
        return [{
            cells: {
                description: this.props.intl.formatMessage({id: 'admin.data_retention.form.text', defaultMessage: 'Applies to all teams and channels, but does not apply to custom retention policies.'}),
                channel_messages: (
                    <div data-testid='global_message_retention_cell'>
                        {this.getGlobalRetentionSetting(DataRetentionSettings?.EnableMessageDeletion, this.props.globalMessageRetentionHours)}
                    </div>
                ),
                files: (
                    <div data-testid='global_file_retention_cell'>
                        {this.getGlobalRetentionSetting(DataRetentionSettings?.EnableFileDeletion, this.props.globalFileRetentionHours)}
                    </div>
                ),
                actions: (
                    <MenuWrapper
                        isDisabled={false}
                        stopPropagationOnToggle={true}
                    >
                        <div className='text-right'>
                            <a>
                                <i className='icon icon-dots-vertical'/>
                            </a>
                        </div>
                        <Menu
                            openLeft={false}
                            openUp={false}
                            ariaLabel={this.props.intl.formatMessage({id: 'admin.user_item.menuAriaLabel', defaultMessage: 'User Actions Menu'})}
                        >
                            <Menu.ItemAction
                                show={true}
                                onClick={() => {
                                    getHistory().push('/admin_console/compliance/data_retention_settings/global_policy');
                                }}
                                text={this.props.intl.formatMessage({id: 'admin.data_retention.globalPoliciesTable.edit', defaultMessage: 'Edit'})}
                                disabled={false}
                                buttonClass={'edit_global_policy'}
                            />
                        </Menu>
                    </MenuWrapper>
                ),
            },
            onClick: () => {
                getHistory().push('/admin_console/compliance/data_retention_settings/global_policy');
            },
        }];
    };
    getChannelAndTeamCounts = (policy: DataRetentionCustomPolicy): JSX.Element => {
        if (policy.channel_count === 0 && policy.team_count === 0) {
            return (
                <FormattedMessage
                    id='admin.data_retention.channel_team_counts_empty'
                    defaultMessage='N/A'
                />
            );
        }
        return (
            <FormattedMessage
                id='admin.data_retention.channel_team_counts'
                defaultMessage='{team_count} {team_count, plural, one {team} other {teams}}, {channel_count} {channel_count, plural, one {channel} other {channels}}'
                values={{
                    team_count: policy.team_count,
                    channel_count: policy.channel_count,
                }}
            />
        );
    };
    getCustomPolicyRows = (startCount: number, endCount: number): Row[] => {
        let policies = Object.values(this.props.customPolicies);
        policies = policies.slice(startCount - 1, endCount);

        return policies.map((policy: DataRetentionCustomPolicy) => {
            const desciptionId = `customDescription-${policy.id}`;
            const durationId = `customDuration-${policy.id}`;
            const appliedToId = `customAppliedTo-${policy.id}`;
            const menuWrapperId = `customWrapper-${policy.id}`;
            return {
                cells: {
                    description: (
                        <div id={desciptionId}>
                            {policy.display_name}
                        </div>
                    ),
                    channel_messages: (
                        <div id={durationId}>
                            {this.getMessageRetentionSetting(policy.post_duration !== -1, policy.post_duration)}
                        </div>
                    ),
                    applied_to: (
                        <div id={appliedToId}>
                            {this.getChannelAndTeamCounts(policy)}
                        </div>
                    ),
                    actions: (
                        <MenuWrapper
                            isDisabled={false}
                            stopPropagationOnToggle={true}
                            id={menuWrapperId}
                        >
                            <div className='text-right'>
                                <a>
                                    <i className='icon icon-dots-vertical'/>
                                </a>
                            </div>
                            <Menu
                                openLeft={false}
                                openUp={false}
                                ariaLabel={this.props.intl.formatMessage({id: 'admin.user_item.menuAriaLabel', defaultMessage: 'User Actions Menu'})}
                            >
                                <Menu.ItemAction
                                    show={true}
                                    onClick={() => {
                                        getHistory().push(`/admin_console/compliance/data_retention_settings/custom_policy/${policy.id}`);
                                    }}
                                    text={this.props.intl.formatMessage({id: 'admin.data_retention.globalPoliciesTable.edit', defaultMessage: 'Edit'})}
                                    disabled={false}
                                />
                                <Menu.ItemAction
                                    show={true}
                                    onClick={() => {
                                        this.deleteCustomPolicy(policy.id);
                                    }}
                                    text={this.props.intl.formatMessage({id: 'admin.data_retention.globalPoliciesTable.delete', defaultMessage: 'Delete'})}
                                    disabled={false}
                                />
                            </Menu>
                        </MenuWrapper>
                    ),
                },
                onClick: () => {
                    getHistory().push(`/admin_console/compliance/data_retention_settings/custom_policy/${policy.id}`);
                },
            };
        });
    };
    private loadPage = async (page: number) => {
        this.setState({customPoliciesLoading: true});
        await this.props.actions.getDataRetentionCustomPolicies(page);
        this.setState({page, customPoliciesLoading: false});
    };
    componentDidMount = async () => {
        await this.loadPage(this.state.page);
    };

    private nextPage = () => {
        this.loadPage(this.state.page + 1);
    };

    private previousPage = () => {
        this.loadPage(this.state.page - 1);
    };

    public getPaginationProps = (): {startCount: number; endCount: number; total: number} => {
        const {page} = this.state;
        const startCount = (page * PAGE_SIZE) + 1;
        const total = this.props.customPoliciesCount;
        let endCount = (page + 1) * PAGE_SIZE;
        endCount = endCount > total ? total : endCount;

        return {startCount, endCount, total};
    };

    showEditJobTime = (value: boolean) => {
        this.setState({showEditJobTime: value});
    };

    componentDidUpdate = (prevProps: Props, prevState: State) => {
        if (prevState.showEditJobTime !== this.state.showEditJobTime && this.state.showEditJobTime) {
            this.inputRef.current?.focus();
        }
    };

    handleCreateJob = async (e?: React.SyntheticEvent) => {
        e?.preventDefault();
        const job = {
            type: JobTypes.DATA_RETENTION as JobType,
        };

        await this.props.actions.createJob(job);
        await this.props.actions.getJobsByType(JobTypes.DATA_RETENTION as JobType);
    };

    changeJobTimeConfig = async (value: string) => {
        const newConfig = JSON.parse(JSON.stringify(this.props.config));
        newConfig.DataRetentionSettings.DeletionJobStartTime = value;

        await this.props.actions.patchConfig(newConfig);
        this.inputRef.current?.blur();
    };

    getJobStartTime = (): JSX.Element | null => {
        const {DataRetentionSettings} = this.props.config;
        const timeArray = DataRetentionSettings?.DeletionJobStartTime?.split(':');
        if (!timeArray) {
            return null;
        }
        let hour = parseInt(timeArray[0], 10);
        if (hour < 12) {
            if (hour === 0) {
                hour = 12;
            }
            return (
                <FormattedMessage
                    id='admin.data_retention.jobTimeAM'
                    defaultMessage='{time} AM (UTC)'
                    values={{
                        time: `${hour}:${timeArray[1]}`,
                    }}
                />
            );
        }
        if (hour !== 12) {
            hour -= 12;
        }
        return (
            <FormattedMessage
                id='admin.data_retention.jobTimePM'
                defaultMessage='{time} PM (UTC)'
                values={{
                    time: `${hour}:${timeArray[1]}`,
                }}
            />
        );
    };
    getJobTimeOptions = () => {
        const options: OptionType[] = [];
        return () => {
            if (options.length > 0) {
                return options;
            }
            const minuteIntervals = ['00', '15', '30', '45'];
            for (let h = 0; h < 24; h++) {
                let hourLabel = h;
                let hourValue = `${h}`;
                const timeOfDay = h >= 12 ? 'pm' : 'am';
                if (hourLabel < 10) {
                    hourValue = `0${hourValue}`;
                }
                if (hourLabel > 12) {
                    hourLabel -= 12;
                }
                if (hourLabel === 0) {
                    hourLabel = 12;
                }
                for (let i = 0; i < minuteIntervals.length; i++) {
                    options.push({label: `${hourLabel}:${minuteIntervals[i]}${timeOfDay}`, value: `${hourValue}:${minuteIntervals[i]}`});
                }
            }

            return options;
        };
    };
    getJobTimes = this.getJobTimeOptions();

    render = () => {
        const {DataRetentionSettings} = this.props.config;
        const {startCount, endCount, total} = this.getPaginationProps();

        return (
            <div className='wrapper--fixed DataRetentionSettings'>
                <AdminHeader>
                    <FormattedMessage {...messages.settings_title}/>
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <Card
                            expanded={true}
                            className={'console'}
                        >
                            <Card.Header>
                                <TitleAndButtonCardHeader
                                    title={<FormattedMessage {...messages.globalPolicy_title}/>}
                                    subtitle={<FormattedMessage {...messages.globalPolicy_subTitle}/>}
                                />
                            </Card.Header>
                            <Card.Body
                                expanded={true}
                            >
                                <div id='global_policy_table'>
                                    <DataGrid
                                        columns={this.getGlobalPolicyColumns()}
                                        rows={this.getGlobalPolicyRows()}
                                        loading={false}
                                        page={0}
                                        nextPage={() => {}}
                                        previousPage={() => {}}
                                        startCount={1}
                                        endCount={4}
                                        total={0}
                                        className={'customTable'}
                                    />
                                </div>
                            </Card.Body>
                        </Card>
                        <Card
                            expanded={true}
                            className={'console'}
                        >
                            <Card.Header>
                                <TitleAndButtonCardHeader
                                    title={<FormattedMessage {...messages.customPolicies_title}/>}
                                    subtitle={<FormattedMessage {...messages.customPolicies_subTitle}/>}
                                    buttonText={
                                        <FormattedMessage
                                            id='admin.data_retention.customPolicies.addPolicy'
                                            defaultMessage='Add policy'
                                        />
                                    }
                                    onClick={() => {
                                        getHistory().push('/admin_console/compliance/data_retention_settings/custom_policy');
                                    }}
                                />
                            </Card.Header>
                            <Card.Body
                                expanded={true}
                            >
                                <div id='custom_policy_table'>
                                    <DataGrid
                                        columns={this.getCustomPolicyColumns()}
                                        rows={this.getCustomPolicyRows(startCount, endCount)}
                                        loading={this.state.customPoliciesLoading}
                                        page={this.state.page}
                                        nextPage={this.nextPage}
                                        previousPage={this.previousPage}
                                        startCount={startCount}
                                        endCount={endCount}
                                        total={total}
                                        className={'customTable'}
                                    />
                                </div>
                            </Card.Body>
                        </Card>
                        <Card
                            expanded={true}
                            className={'console'}
                        >
                            <Card.Header>
                                <TitleAndButtonCardHeader
                                    title={<FormattedMessage {...messages.jobCreation_title}/>}
                                    subtitle={<FormattedMessage {...messages.jobCreation_subTitle}/>}
                                    buttonText={<FormattedMessage {...messages.createJob_title}/>}
                                    isDisabled={String(DataRetentionSettings?.EnableMessageDeletion) !== 'true' && String(DataRetentionSettings?.EnableFileDeletion) !== 'true' && (this.props.customPoliciesCount === 0)}
                                    onClick={this.handleCreateJob}
                                />
                            </Card.Header>
                            <Card.Body
                                expanded={true}
                            >
                                <JobsTable
                                    jobType={JobTypes.DATA_RETENTION as JobType}
                                    hideJobCreateButton={true}
                                    className={'job-table__data-retention'}
                                    disabled={String(DataRetentionSettings?.EnableMessageDeletion) !== 'true' && String(DataRetentionSettings?.EnableFileDeletion) !== 'true'}
                                    createJobButtonText={<FormattedMessage {...messages.createJob_title}/>}
                                    createJobHelpText={
                                        <div>
                                            <FormattedMessage {...messages.createJob_instructions}/>
                                            {this.state.showEditJobTime ? (
                                                <ReactSelect
                                                    id={'JobSelectTime'}
                                                    className={'JobSelectTime'}
                                                    components={{
                                                        DropdownIndicator: () => null,
                                                        IndicatorSeparator: () => null,
                                                    }}
                                                    onChange={(e) => {
                                                        this.changeJobTimeConfig((e as OptionType).value);
                                                    }}
                                                    styles={{
                                                        control: (base) => ({
                                                            ...base,
                                                            height: 32,
                                                            minHeight: 32,
                                                        }),
                                                        menu: (base) => ({
                                                            ...base,
                                                            width: 210,
                                                        }),
                                                    }}
                                                    onBlur={() => {
                                                        this.showEditJobTime(false);
                                                    }}
                                                    value={{label: this.getJobStartTime(), value: DataRetentionSettings?.DeletionJobStartTime} as OptionType}
                                                    hideSelectedOptions={true}
                                                    isSearchable={true}
                                                    options={this.getJobTimes()}
                                                    ref={this.inputRef}
                                                    onFocus={() => {
                                                        this.showEditJobTime(true);
                                                    }}
                                                    menuIsOpen={this.state.showEditJobTime}
                                                />
                                            ) : (
                                                <span
                                                    className='JobSelectedtime'
                                                >
                                                    <b>{this.getJobStartTime()}</b>
                                                </span>
                                            )}
                                            <a
                                                className='EditJobTime'
                                                onClick={() => this.showEditJobTime(true)}
                                            >
                                                {this.props.intl.formatMessage({id: 'admin.data_retention.globalPoliciesTable.edit', defaultMessage: 'Edit'})}
                                            </a>
                                        </div>
                                    }
                                />
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>
        );
    };
}

export default injectIntl(DataRetentionSettings);
