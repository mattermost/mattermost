import { AccessControlPolicy } from '@mattermost/types/admin';
import React from 'react';
import { FormattedMessage } from 'react-intl';

import DataGrid, { Row, Column } from 'components/admin_console/data_grid/data_grid';

import './policies.scss';
import {getHistory} from 'utils/browser_history';
import type {ActionResult} from 'mattermost-redux/types/actions';

type Props = {
    actions: {
        searchPolicies: (term: string, type: string, after: string, limit: number) => Promise<ActionResult>;
    };
};

type State = {
    policies: AccessControlPolicy[];
    page: number;
    after: string;
    loading: boolean;
    search: string;
    searchErrored: boolean;
    cursorHistory: string[];
    total: number;
};

const PAGE_SIZE = 10;

export default class PolicyList extends React.PureComponent<Props, State> {
    private mounted = false;

    constructor(props: Props) {
        super(props);

        this.state = {
            policies: [],
            loading: false,
            search: '',
            page: 0,
            after: '',
            searchErrored: false,
            cursorHistory: [],
            total: 0,
        };
    }

    componentDidMount() {
        this.mounted = true;
        this.fetchPolicies();
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    fetchPolicies = async (term = '', after = '', resetPage = false) => {
        if (!this.mounted) {
            return;
        }

        this.setState({loading: true});
        
        try {
            const action = await this.props.actions.searchPolicies(term, 'parent', after, PAGE_SIZE + 1);
            const data = action.data.policies || [];
            const total = action.data.total || 0;

            // Check if we have more data than the page size, indicating there's a next page
            const hasNextPage = data.length > PAGE_SIZE;
            // If we have more data than needed, remove the extra item (which is used to check for next page)
            const policies = hasNextPage ? data.slice(0, PAGE_SIZE) : data;
            
            // Get the ID of the last policy for the next cursor
            const lastPolicyId = policies.length > 0 ? policies[policies.length - 1].id : '';
            
            if (resetPage) {
                this.setState({
                    policies,
                    loading: false,
                    after: lastPolicyId,
                    total,
                    page: 0,
                    cursorHistory: [],
                });
            } else {
                this.setState({
                    policies,
                    loading: false,
                    after: lastPolicyId,
                    total,
                });
            }
        } catch (error) {
            this.setState({loading: false, searchErrored: true});
        }
    }

    onSearch = async (term: string) => {
        if (term.length === 0) {
            this.setState({
                page: 0,
                after: '',
                loading: false,
                searchErrored: false,
                search: '', 
            }, () => {
                this.fetchPolicies();
            });
            return;
        }
        
        this.setState({loading: true, search: term});
        await this.fetchPolicies(term, '', true);
    };

    nextPage = async () => {
        const {after, cursorHistory, search} = this.state;
        
        // Save current cursor to history for "previous" navigation
        const newCursorHistory = [...cursorHistory, after];
        
        this.setState({
            loading: true,
            page: this.state.page + 1,
            cursorHistory: newCursorHistory,
        });
        
        await this.fetchPolicies(search, after);
    };

    previousPage = async () => {
        const {cursorHistory, search} = this.state;
        
        if (cursorHistory.length === 0) {
            return;
        }
        
        // Remove the current cursor from history
        const newCursorHistory = [...cursorHistory];
        newCursorHistory.pop();
        
        // Get the previous cursor
        const previousCursor = newCursorHistory.length > 0 ? newCursorHistory[newCursorHistory.length - 1] : '';
        
        this.setState({
            loading: true,
            page: this.state.page - 1,
            cursorHistory: newCursorHistory,
        });
        
        await this.fetchPolicies(search, previousCursor);
    };

    getRows = (): Row[] => {
        const { policies } = this.state;
        
        if (!policies.length) {
            return [];
        }

        return policies.map((policy: AccessControlPolicy) => ({
            cells: {
                name: policy.name,
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
        }));
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
            {
                name: <span></span>,
                field: 'actions',
                className: 'actions-column',
            },
        ];
    };

    getPaginationProps = () => {
        const { policies, page, total } = this.state;
        const startCount = page * PAGE_SIZE + 1;
        const endCount = startCount + policies.length - 1;

        return {
            startCount,
            endCount,
            total,
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

