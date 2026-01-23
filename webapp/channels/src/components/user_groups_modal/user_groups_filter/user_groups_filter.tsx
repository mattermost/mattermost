// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import * as Menu from 'components/menu';

type Props = {
    selectedFilter: string;
    getGroups: (page: number, groupType: string) => void;
    onToggle: (isOpen: boolean) => void;
}

const UserGroupsFilter = (props: Props) => {
    const {
        selectedFilter,
        getGroups,
    } = props;

    const intl = useIntl();

    const allGroupsOnClick = useCallback(() => {
        getGroups(0, 'all');
    }, [getGroups]);

    const myGroupsOnClick = useCallback(() => {
        getGroups(0, 'my');
    }, [getGroups]);

    const archivedGroupsOnClick = useCallback(() => {
        getGroups(0, 'archived');
    }, [getGroups]);

    const filterLabel = useCallback(() => {
        if (selectedFilter === 'all') {
            return intl.formatMessage({id: 'user_groups_modal.showAllGroups', defaultMessage: 'Show: All Groups'});
        } else if (selectedFilter === 'my') {
            return intl.formatMessage({id: 'user_groups_modal.showMyGroups', defaultMessage: 'Show: My Groups'});
        } else if (selectedFilter === 'archived') {
            return intl.formatMessage({id: 'user_groups_modal.showArchivedGroups', defaultMessage: 'Show: Archived Groups'});
        }
        return '';
    }, [selectedFilter]);

    return (
        <div className='more-modal__dropdown'>
            <Menu.Container
                menuButton={{
                    id: 'groupsFilterDropdown',
                    class: 'groups-filter-btn',
                    children: (
                        <>
                            <span>{filterLabel()}</span>
                            <span className='icon icon-chevron-down'/>
                        </>
                    ),
                }}
                menu={{
                    id: 'groupsFilterDropdownMenu',
                    onToggle: props.onToggle,
                    'aria-label': intl.formatMessage({id: 'user_groups_modal.filterAriaLabel', defaultMessage: 'Groups Filter'}),
                }}
            >
                <Menu.Item
                    id='groupsDropdownAll'
                    onClick={allGroupsOnClick}
                    labels={
                        <FormattedMessage
                            id='user_groups_modal.allGroups'
                            defaultMessage='All Groups'
                        />
                    }
                    trailingElements={selectedFilter === 'all' && <i className='icon icon-check'/>}
                />
                <Menu.Item
                    id='groupsDropdownMy'
                    onClick={myGroupsOnClick}
                    labels={
                        <FormattedMessage
                            id='user_groups_modal.myGroups'
                            defaultMessage='My Groups'
                        />
                    }
                    trailingElements={selectedFilter === 'my' && <i className='icon icon-check'/>}
                />
                <Menu.Separator/>
                <Menu.Item
                    id='groupsDropdownArchived'
                    onClick={archivedGroupsOnClick}
                    labels={
                        <FormattedMessage
                            id='user_groups_modal.archivedGroups'
                            defaultMessage='Archived Groups'
                        />
                    }
                    trailingElements={selectedFilter === 'archived' && <i className='icon icon-check'/>}
                />
            </Menu.Container>
        </div>
    );
};

export default React.memo(UserGroupsFilter);
