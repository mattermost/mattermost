import { AccessControlPolicy } from '@mattermost/types/admin';
import React from 'react';
import { FormattedMessage } from 'react-intl';

import DataGrid, { Row, Column } from 'components/admin_console/data_grid/data_grid';

import './policies.scss';
import {getHistory} from 'utils/browser_history';
import type {ActionResult} from 'mattermost-redux/types/actions';

type Props = {
    actions: {
        getAccessControlPolicies: (page: number, pageSize: number) => Promise<ActionResult>;
    };
};

type State = {
    policies: AccessControlPolicy[];

    page: number;
    loading: boolean;
    search: string;
    searchErrored: boolean;
};

const PAGE_SIZE = 10;

export default class PolicyList extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            policies: [],
            loading: false,
            search: '',
            page: 0,
            searchErrored: false,
        };
    }

    private mounted = false;

    // Add componentDidMount to fetch policies when the component loads
    async componentDidMount() {
        this.mounted = true;
        this.fetchPolicies();
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    fetchPolicies = async () => {
        const {page} = this.state;
        this.setState({loading: true});
    
        try {
            if (!this.mounted) {
                return;
            }
            const action = await this.props.actions.getAccessControlPolicies(page, PAGE_SIZE);
            const data = {...action.data};
            this.setState({policies: data || [], loading: false});
        } catch (error) {
            this.setState({loading: false, searchErrored: true});
        }
    }


    isSearching = (term: string) => {
        return term.length > 0;
    };

    onSearch = (term: string) => {
        // this.props.onSearchChange(term);
        this.setState({ page: 0 });
    };

    nextPage = () => {
        const page = this.state.page + 1;
        this.setState({page});
    };

    previousPage = () => {
        const page = this.state.page - 1;
        this.setState({page});
    };

    getRows = (): Row[] => {
        const {startCount, endCount} = this.getPaginationProps();
        const sortedPolicies = Object.values(this.state.policies).sort((a, b) => {
            const timeA = new Date(a.created_at || 0).valueOf();
            const timeB = new Date(b.created_at || 0).valueOf();

            return timeB - timeA;
        });

        if (!sortedPolicies) {
            return [];
        }

        return Object.values(sortedPolicies).map((policy: AccessControlPolicy) => {
            return {
                cells: {
                    name: policy.name,
                    // properties: policy.properties?.join(', '),
                    // applies_to: (
                    //     <FormattedMessage
                    //         id='admin.access_control.policies.channels_count'
                    //         defaultMessage='{count} channels'
                    //         values={{
                    //             count: 4, // TODO: get the actual number of channels
                    //         }}
                    //     />
                    // ),
                    actions: (
                        <div className='action-wrapper'>
                            <a
                                onClick={(e) => {
                                    e.preventDefault();
                                    getHistory().push(`/admin_console/user_management/attribute_based_access_control/edit_policy/${policy.id}`);
                                }}
                            >
                                Edit
                            </a>
                        </div>
                    ),
                },
                onClick: () => {
                    getHistory().push(`/admin_console/user_management/attribute_based_access_control/edit_policy/${policy.id}`);
                }
            };
        });
    };

    getColumns = (): Column[] => {
        return [
            {
                name: (
                    <FormattedMessage
                        id='admin.access_control.policies.name'
                        defaultMessage='Name'
                    />
                ),
                field: 'name',
            },
            // {
            //     name: (
            //         <FormattedMessage
            //             id='admin.access_control.policies.properties'
            //             defaultMessage='Properties'
            //         />
            //     ),
            //     field: 'properties',
            // },
            // {
            //     name: (
            //         <FormattedMessage
            //             id='admin.access_control.policies.applies_to'
            //             defaultMessage='Applies to'
            //         />
            //     ),
            //     field: 'applies_to',
            // },
            {
                name: (
                    <span></span>
                ),
                field: 'actions',
                className: 'actions-column',
            },
        ];
    };

    getPaginationProps = () => {
        const { policies } = this.state;
        const { page } = this.state;
        const startCount = page * PAGE_SIZE;
        const endCount = Math.min(startCount + PAGE_SIZE, policies.length);

        return {
            page,
            startCount: startCount + 1,
            endCount,
            total: policies.length,
            onNextPage: this.nextPage,
            onPreviousPage: this.previousPage,
        };
    };

    render = (): JSX.Element => {
        const { search, searchErrored } = this.state;
        const rows: Row[] = this.getRows();
        const columns: Column[] = this.getColumns();
        const {startCount, endCount, total} = this.getPaginationProps();

        let placeholderEmpty: JSX.Element = (
            <FormattedMessage
                id='admin.user_settings.policy_list.no_policies_found'
                defaultMessage='No policies found'
            />
        );

        if (searchErrored) {
            placeholderEmpty = (
                <FormattedMessage
                    id='admin.user_settings.policy_list.search_policy_errored'
                    defaultMessage='Something went wrong. Try again'
                />
            );
        } 

        const rowsContainerStyles = {
            minHeight: `${rows.length * 40}px`,
        };


        return (
            <div className='PolicyTable'>
                <div className='policy-header'>
                <div className='policy-header-text'>
                    <h1>Access policies</h1>
                    <p>Create policies containing attribute based access rules and the objects they apply to.</p>
                </div>
                <button 
                    className='btn btn-primary'
                    onClick={() => {
                        getHistory().push('/admin_console/user_management/attribute_based_access_control/edit_policy');
                    }}>
                    <i className='icon icon-plus'></i>
                    <span>Add policy</span>
                </button>
            </div>
                <DataGrid
                    columns={columns}
                    rows={rows}
                    loading={this.state.loading}
                    startCount={startCount}
                    endCount={endCount}
                    total={total}
                    onSearch={this.onSearch}
                    term={search}
                    placeholderEmpty={placeholderEmpty}
                    rowsContainerStyles={rowsContainerStyles}
                    page={this.state.page}
                    nextPage={this.nextPage}
                    previousPage={this.previousPage}
                />
            </div>
        );
    }
}

