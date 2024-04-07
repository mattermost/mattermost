// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React, {useEffect, useCallback, useState, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {MagnifyIcon} from '@mattermost/compass-icons/components';
import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {QuickInput} from 'components/quick_input/quick_input';
import GroupMemberList from 'components/user_group_popover/group_member_list';
import UserGroupsModal from 'components/user_groups_modal';
import ViewUserGroupModal from 'components/view_user_group_modal';
import Popover from 'components/widgets/popover';

import Constants, {A11yClassNames, A11yCustomEventTypes, ModalIdentifiers} from 'utils/constants';
import type {A11yFocusEventDetail} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {shouldFocusMainTextbox} from 'utils/post_utils';

import type {ModalData} from 'types/actions';

import {Load} from './constants';
import useShouldClose from './useShouldClose';

import './user_group_popover.scss';

export type Props = {

    /**
     * The group corresponding to the parent popover
     */
    group: Group;

    /**
     * Function to call if parent popover should be hidden
     */
    hide: () => void;

    /**
     * Function to call if focus should be returned to triggering element
     */
    returnFocus: () => void;

    /**
     * Function to call to show a profile popover and hide parent popover
     */
    showUserOverlay: (user: UserProfile) => void;

    /**
     * @internal
     */
    searchTerm: string;

    actions: {
        setPopoverSearchTerm: (term: string) => void;
        searchProfiles: (term: string, options: any) => Promise<ActionResult>;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
}

const UserGroupPopover = ({
    actions,
    group,
    hide,
    returnFocus,
    searchTerm,
    showUserOverlay,

    // These props are not passed explictly to this component, but
    // they are added when this component is passed as a child to Overlay.
    // They are not typed in the component because they will cause more confusion.
    ...popoverProps
}: Props) => {
    const {formatMessage} = useIntl();

    const closeRef = useRef<HTMLButtonElement>(null);

    const [searchState, setSearchState] = useState(Load.DONE);

    const shouldClose = useShouldClose();

    const doSearch = useCallback(debounce(async (term) => {
        const res = await actions.searchProfiles(term, {in_group_id: group.id});
        if (res.data) {
            setSearchState(Load.DONE);
        } else {
            setSearchState(Load.FAILED);
        }
    }, Constants.SEARCH_TIMEOUT_MILLISECONDS), [actions.searchProfiles]);

    useEffect(() => {
        // Focus the close button when the popover first opens
        document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
            A11yCustomEventTypes.FOCUS, {
                detail: {
                    target: closeRef.current,
                    keyboardOnly: true,
                },
            },
        ));

        // Unset the popover search term on mount and unmount
        // This is to prevent some odd rendering issues when quickly opening and closing popovers
        actions.setPopoverSearchTerm('');
        return () => {
            actions.setPopoverSearchTerm('');
        };
    }, []);

    useEffect(() => {
        if (searchTerm) {
            setSearchState(Load.LOADING);
            doSearch(searchTerm);
        } else {
            setSearchState(Load.DONE);
            doSearch.cancel();
        }
    }, [searchTerm, doSearch]);

    useEffect(() => {
        if (shouldClose) {
            hide();
        }
    }, [hide, shouldClose]);

    const openGroupsModal = () => {
        actions.openModal({
            modalId: ModalIdentifiers.USER_GROUPS,
            dialogType: UserGroupsModal,
            dialogProps: {
                backButtonAction: openGroupsModal,
                onExited: returnFocus,
            },
        });
    };

    const openViewGroupModal = () => {
        hide();
        actions.openModal({
            modalId: ModalIdentifiers.VIEW_USER_GROUP,
            dialogType: ViewUserGroupModal,
            dialogProps: {
                groupId: group.id,
                backButtonCallback: openGroupsModal,
                backButtonAction: openViewGroupModal,
                onExited: returnFocus,
            },
        });
    };

    const handleClose = () => {
        hide();
        returnFocus();
    };

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        actions.setPopoverSearchTerm(event.target.value);
    };

    const handleClear = () => {
        actions.setPopoverSearchTerm('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (shouldFocusMainTextbox(e, document.activeElement)) {
            hide();
        } else if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ESCAPE)) {
            returnFocus();
        }
    };

    const tabCatcher = (
        <span
            tabIndex={0}
            onFocus={(e) => {
                (e.relatedTarget as HTMLElement)?.focus();
            }}
        />
    );

    return (
        <Popover
            id='user-group-popover'
            {...popoverProps}
        >
            {tabCatcher}
            <Body
                role='dialog'
                aria-modal={true}
                onKeyDown={handleKeyDown}
                className={A11yClassNames.POPUP}
                aria-label={group.display_name}
            >
                <Header>
                    <Heading>
                        <Title
                            className='overflow--ellipsis text-nowrap'
                        >
                            {group.display_name}
                        </Title>
                        <CloseButton
                            className='btn btn-sm btn-compact btn-icon'
                            aria-label={formatMessage({id: 'user_group_popover.close', defaultMessage: 'Close'})}
                            onClick={handleClose}
                            ref={closeRef}
                        >
                            <i
                                className='icon icon-close'
                            />
                        </CloseButton>
                    </Heading>
                    <Subtitle>
                        <span className='overflow--ellipsis text-nowrap'>{'@'}{group.name}</span>
                        <Dot>{'•'}</Dot>
                        <FormattedMessage
                            id='user_group_popover.memberCount'
                            defaultMessage='{member_count} {member_count, plural, one {Member} other {Members}}'
                            values={{
                                member_count: group.member_count,
                            }}
                            tagName={NoShrink}
                        />
                    </Subtitle>
                    <HeaderButton
                        aria-label={`${group.display_name} @${group.name} ${formatMessage({id: 'user_group_popover.memberCount', defaultMessage: '{member_count} {member_count, plural, one {Member} other {Members}}'}, {member_count: group.member_count})} ${formatMessage({id: 'user_group_popover.openGroupModal', defaultMessage: 'View full group info'})}`}
                        onClick={openViewGroupModal}
                        className='user-group-popover_header-button'
                    />
                </Header>
                {group.member_count > 10 ? (
                    <SearchBar>
                        <MagnifyIcon/>
                        <QuickInput
                            type='text'
                            className='user-group-popover_search-bar'
                            placeholder={formatMessage({id: 'user_group_popover.searchGroupMembers', defaultMessage: 'Search members'})}
                            value={searchTerm}
                            onChange={handleSearch}
                            clearable={true}
                            onClear={handleClear}
                        />
                    </SearchBar>
                ) : null}
                <GroupMemberList
                    group={group}
                    hide={hide}
                    searchState={searchState}
                    showUserOverlay={showUserOverlay}
                />
            </Body>
            {tabCatcher}
        </Popover>);
};

const Body = styled.div`
    width: 264px;
`;

const Header = styled.div`
    padding: 16px 20px;
    position: relative;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const HeaderButton = styled.button`
    padding: 0;
    background: none;
    border: none;
    display: block;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 100%;
`;

const Title = styled.span`
    flex: 1 1 auto;
`;

const CloseButton = styled.button`
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    margin-left: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    right: -4px;
    top: -2px;

    /* Place this button above the main header button */
    z-index: 9;

    svg {
        width: 18px;
    }
`;

const Heading = styled.div`
    font-weight: 600;
    font-size: 16px;
    display: flex;
    align-items: center;
    font-family: 'Metropolis', sans-serif;
`;

const Subtitle = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    display: flex;
`;

const NoShrink = styled.span`
    flex: 0 0 auto;
`;

const Dot = styled(NoShrink)`
    padding: 0 6px;
`;

const SearchBar = styled.div`
    margin: 4px 12px 12px 12px;
    padding: 0 1px;
    height: 32px;
    position: relative;
    display: flex;
    align-items: center;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    overflow: hidden;

    &:hover {
        border-color: rgba(var(--center-channel-color-rgb), 0.48);
    }

    &:focus-within {
        border-color: var(--button-bg);
        box-shadow: inset 0 0 0 1px var(--button-bg);
    }

    & > div {
        display: flex;
        align-items: center;
        flex: 1;
    }

    input {
        width: 100%;
        font-size: 12px;
        border: none;
        padding: 0;
        color: var(--center-channel-color);
        background: var(--center-channel-bg);
        flex: 1;
    }

    input.a11y--focused {
        box-shadow: none;
    }

    svg {
        width: 18px;
        height: 100%;
        margin: 0 6px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }

    .input-clear {
        width: 36px;
        position: relative;
        right: 0;
    }

    .icon {
        display: flex;
        font-size: 14px;
    }
`;

export default React.memo(UserGroupPopover);
