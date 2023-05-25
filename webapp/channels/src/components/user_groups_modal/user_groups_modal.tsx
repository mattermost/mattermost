// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {createRef, RefObject} from 'react';

import {Modal} from 'react-bootstrap';

import Constants from 'utils/constants';

import * as Utils from 'utils/utils';
import {Group, GroupSearachParams} from '@mattermost/types/groups';

import './user_groups_modal.scss';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import Menu from 'components/widgets/menu/menu';
import {debounce} from 'mattermost-redux/actions/helpers';
import Input from 'components/widgets/inputs/input/input';
import NoResultsIndicator from 'components/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';

import UserGroupsList from './user_groups_list';
import UserGroupsModalHeader from './user_groups_modal_header';
import ADLDAPUpsellBanner from './ad_ldap_upsell_banner';

const GROUPS_PER_PAGE = 60;

export type Props = {
    onExited: () => void;
    groups: Group[];
    myGroups: Group[];
    searchTerm: string;
    currentUserId: string;
    backButtonAction: () => void;
    actions: {
        getGroups: (
            filterAllowReference?: boolean,
            page?: number,
            perPage?: number,
            includeMemberCount?: boolean
        ) => Promise<{data: Group[]}>;
        setModalSearchTerm: (term: string) => void;
        getGroupsByUserIdPaginated: (
            userId: string,
            filterAllowReference?: boolean,
            page?: number,
            perPage?: number,
            includeMemberCount?: boolean
        ) => Promise<{data: Group[]}>;
        searchGroups: (
            params: GroupSearachParams,
        ) => Promise<{data: Group[]}>;
    };
}

type State = {
    page: number;
    myGroupsPage: number;
    loading: boolean;
    show: boolean;
    selectedFilter: string;
    allGroupsFull: boolean;
    myGroupsFull: boolean;
}

export default class UserGroupsModal extends React.PureComponent<Props, State> {
    divScrollRef: RefObject<HTMLDivElement>;
    private searchTimeoutId: number;

    constructor(props: Props) {
        super(props);
        this.divScrollRef = createRef();
        this.searchTimeoutId = 0;

        this.state = {
            page: 0,
            myGroupsPage: 0,
            loading: true,
            show: true,
            selectedFilter: 'all',
            allGroupsFull: false,
            myGroupsFull: false,
        };
    }

    doHide = () => {
        this.setState({show: false});
    };

    async componentDidMount() {
        const {
            actions,
        } = this.props;
        await Promise.all([
            actions.getGroups(false, this.state.page, GROUPS_PER_PAGE, true),
            actions.getGroupsByUserIdPaginated(this.props.currentUserId, false, this.state.myGroupsPage, GROUPS_PER_PAGE, true),
        ]);
        this.loadComplete();
    }

    componentWillUnmount() {
        this.props.actions.setModalSearchTerm('');
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.searchTerm !== this.props.searchTerm) {
            clearTimeout(this.searchTimeoutId);
            const searchTerm = this.props.searchTerm;

            if (searchTerm === '') {
                this.loadComplete();
                this.searchTimeoutId = 0;
                return;
            }

            const searchTimeoutId = window.setTimeout(
                async () => {
                    const params: GroupSearachParams = {
                        q: searchTerm,
                        filter_allow_reference: true,
                        page: this.state.page,
                        per_page: GROUPS_PER_PAGE,
                        include_member_count: true,
                    };
                    if (this.state.selectedFilter === 'all') {
                        await prevProps.actions.searchGroups(params);
                    } else {
                        params.user_id = this.props.currentUserId;
                        await prevProps.actions.searchGroups(params);
                    }
                },
                Constants.SEARCH_TIMEOUT_MILLISECONDS,
            );

            this.searchTimeoutId = searchTimeoutId;
        }
    }

    startLoad = () => {
        this.setState({loading: true});
    };

    loadComplete = () => {
        this.setState({loading: false});
    };

    handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        this.props.actions.setModalSearchTerm(term);
    };

    scrollGetGroups = debounce(
        async () => {
            const {page} = this.state;
            const newPage = page + 1;

            this.setState({page: newPage});
            this.getGroups(newPage);
        },
        500,
        false,
        (): void => {},
    );
    scrollGetMyGroups = debounce(
        async () => {
            const {myGroupsPage} = this.state;
            const newPage = myGroupsPage + 1;

            this.setState({myGroupsPage: newPage});
            this.getMyGroups(newPage);
        },
        500,
        false,
        (): void => {},
    );

    onScroll = () => {
        const scrollHeight = this.divScrollRef.current?.scrollHeight || 0;
        const scrollTop = this.divScrollRef.current?.scrollTop || 0;
        const clientHeight = this.divScrollRef.current?.clientHeight || 0;

        if ((scrollTop + clientHeight + 30) >= scrollHeight) {
            if (this.state.selectedFilter === 'all' && this.state.loading === false && !this.state.allGroupsFull) {
                this.scrollGetGroups();
            }
            if (this.state.selectedFilter !== 'all' && this.props.myGroups.length % GROUPS_PER_PAGE === 0 && this.state.loading === false) {
                this.scrollGetMyGroups();
            }
        }
    };

    getMyGroups = async (page: number) => {
        const {actions} = this.props;

        this.startLoad();
        const data = await actions.getGroupsByUserIdPaginated(this.props.currentUserId, false, page, GROUPS_PER_PAGE, true);
        if (data.data.length === 0) {
            this.setState({myGroupsFull: true});
        }
        this.loadComplete();
        this.setState({selectedFilter: 'my'});
    };

    getGroups = async (page: number) => {
        const {actions} = this.props;

        this.startLoad();
        const data = await actions.getGroups(false, page, GROUPS_PER_PAGE, true);
        if (data.data.length === 0) {
            this.setState({allGroupsFull: true});
        }
        this.loadComplete();
        this.setState({selectedFilter: 'all'});
    };

    render() {
        const groups = this.state.selectedFilter === 'all' ? this.props.groups : this.props.myGroups;

        return (
            <Modal
                dialogClassName='a11y__modal user-groups-modal'
                show={this.state.show}
                onHide={this.doHide}
                onExited={this.props.onExited}
                role='dialog'
                aria-labelledby='userGroupsModalLabel'
                id='userGroupsModal'
            >
                <UserGroupsModalHeader
                    onExited={this.props.onExited}
                    backButtonAction={this.props.backButtonAction}
                />
                <Modal.Body>
                    {(groups.length === 0 && !this.props.searchTerm) ? <>
                        <NoResultsIndicator
                            variant={NoResultsVariant.UserGroups}
                        />
                        <ADLDAPUpsellBanner/>
                    </> : <>
                        <div className='user-groups-search'>
                            <Input
                                type='text'
                                placeholder={Utils.localizeMessage('user_groups_modal.searchGroups', 'Search Groups')}
                                onChange={this.handleSearch}
                                value={this.props.searchTerm}
                                data-testid='searchInput'
                                className={'user-group-search-input'}
                                inputPrefix={<i className={'icon icon-magnify'}/>}
                            />
                        </div>
                        <div className='more-modal__dropdown'>
                            <MenuWrapper id='groupsFilterDropdown'>
                                <a>
                                    <span>{this.state.selectedFilter === 'all' ? Utils.localizeMessage('user_groups_modal.showAllGroups', 'Show: All Groups') : Utils.localizeMessage('user_groups_modal.showMyGroups', 'Show: My Groups')}</span>
                                    <span className='icon icon-chevron-down'/>
                                </a>
                                <Menu
                                    openLeft={false}
                                    ariaLabel={Utils.localizeMessage('user_groups_modal.filterAriaLabel', 'Groups Filter Menu')}
                                >
                                    <Menu.ItemAction
                                        id='groupsDropdownAll'
                                        buttonClass='groups-filter-btn'
                                        onClick={() => {
                                            this.getGroups(0);
                                        }}
                                        text={Utils.localizeMessage('user_groups_modal.allGroups', 'All Groups')}
                                        rightDecorator={this.state.selectedFilter === 'all' && <i className='icon icon-check'/>}
                                    />
                                    <Menu.ItemAction
                                        id='groupsDropdownMy'
                                        buttonClass='groups-filter-btn'
                                        onClick={() => {
                                            this.getMyGroups(0);
                                        }}
                                        text={Utils.localizeMessage('user_groups_modal.myGroups', 'My Groups')}
                                        rightDecorator={this.state.selectedFilter !== 'all' && <i className='icon icon-check'/>}
                                    />
                                </Menu>
                            </MenuWrapper>
                        </div>
                        <UserGroupsList
                            groups={groups}
                            searchTerm={this.props.searchTerm}
                            loading={this.state.loading}
                            onScroll={this.onScroll}
                            ref={this.divScrollRef}
                            onExited={this.props.onExited}
                            backButtonAction={this.props.backButtonAction}
                        />
                    </>
                    }
                </Modal.Body>
            </Modal>
        );
    }
}
