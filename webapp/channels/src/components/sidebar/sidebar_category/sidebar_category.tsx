// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {MouseEvent, KeyboardEvent} from 'react';
import {FormattedMessage} from 'react-intl';
import {Draggable, Droppable} from 'react-beautiful-dnd';
import classNames from 'classnames';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {ChannelCategory, CategorySorting} from '@mattermost/types/channel_categories';
import {PreferenceType} from '@mattermost/types/preferences';
import {localizeMessage} from 'mattermost-redux/utils/i18n_utils';
import {trackEvent} from 'actions/telemetry_actions';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import {DraggingState} from 'types/store';
import {DraggingStateTypes, DraggingStates} from 'utils/constants';
import {t} from 'utils/i18n';
import SidebarChannel from '../sidebar_channel';
import {SidebarCategoryHeader} from '../sidebar_category_header';
import InviteMembersButton from '../invite_members_button';
import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

import AddChannelsCtaButton from '../add_channels_cta_button';

import SidebarCategorySortingMenu from './sidebar_category_sorting_menu';
import SidebarCategoryMenu from './sidebar_category_menu';

type Props = {
    category: ChannelCategory;
    categoryIndex: number;
    channelIds: string[];
    setChannelRef: (channelId: string, ref: HTMLLIElement) => void;
    handleOpenMoreDirectChannelsModal: (e: Event) => void;
    isNewCategory: boolean;
    draggingState: DraggingState;
    currentUserId: string;
    isAdmin: boolean;
    actions: {
        setCategoryCollapsed: (categoryId: string, collapsed: boolean) => void;
        setCategorySorting: (categoryId: string, sorting: CategorySorting) => void;
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
    };
};

type State = {
    isMenuOpen: boolean;
}

export default class SidebarCategory extends React.PureComponent<Props, State> {
    categoryTitleRef: React.RefObject<HTMLButtonElement>;
    newDropBoxRef: React.RefObject<HTMLDivElement>;

    a11yKeyDownRegistered: boolean;

    constructor(props: Props) {
        super(props);

        this.categoryTitleRef = React.createRef();
        this.newDropBoxRef = React.createRef();

        this.state = {
            isMenuOpen: false,
        };

        this.a11yKeyDownRegistered = false;
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.category.collapsed !== prevProps.category.collapsed && this.newDropBoxRef.current) {
            this.newDropBoxRef.current.classList.add('animating');
        }
    }

    renderChannel = (channelId: string, index: number) => {
        const {setChannelRef, category, draggingState} = this.props;
        return (
            <SidebarChannel
                key={channelId}
                channelIndex={index}
                channelId={channelId}
                isDraggable={true}
                setChannelRef={setChannelRef}
                isCategoryCollapsed={category.collapsed}
                isCategoryDragged={draggingState.type === DraggingStateTypes.CATEGORY && draggingState.id === category.id}
                isAutoSortedCategory={category.sorting === CategorySorting.Alphabetical || category.sorting === CategorySorting.Recency}
            />
        );
    };

    handleCollapse = () => {
        const {category} = this.props;

        if (category.collapsed) {
            trackEvent('ui', 'ui_sidebar_expand_category');
        } else {
            trackEvent('ui', 'ui_sidebar_collapse_category');
        }

        this.props.actions.setCategoryCollapsed(category.id, !category.collapsed);
    };

    removeAnimation = () => {
        if (this.newDropBoxRef.current) {
            this.newDropBoxRef.current.classList.remove('animating');
        }
    };

    handleOpenDirectMessagesModal = (event: MouseEvent<HTMLLIElement | HTMLButtonElement> | KeyboardEvent<HTMLLIElement | HTMLButtonElement>) => {
        event.preventDefault();

        this.props.handleOpenMoreDirectChannelsModal(event.nativeEvent);
        trackEvent('ui', 'ui_sidebar_create_direct_message');
    };

    isDropDisabled = () => {
        const {draggingState, category} = this.props;

        if (category.type === CategoryTypes.DIRECT_MESSAGES) {
            return draggingState.type === DraggingStateTypes.CHANNEL;
        } else if (category.type === CategoryTypes.CHANNELS) {
            return draggingState.type === DraggingStateTypes.DM;
        }

        return false;
    };

    renderNewDropBox = (isDraggingOver: boolean) => {
        const {draggingState, category, isNewCategory, channelIds} = this.props;

        if (!isNewCategory || channelIds?.length) {
            return null;
        }

        return (
            <React.Fragment>
                <Draggable
                    draggableId={`NEW_CHANNEL_SPACER__${category.id}`}
                    isDragDisabled={true}
                    index={0}
                >
                    {(provided) => {
                        // NEW_CHANNEL_SPACER here is used as a spacer to ensure react-beautiful-dnd will not try and place the first channel
                        // on the header. This acts as a space filler for the header so that the first channel dragged in will float below it.
                        return (
                            <li
                                ref={provided.innerRef}
                                draggable='false'
                                className={'SidebarChannel noFloat newChannelSpacer'}
                                {...provided.draggableProps}
                                role='listitem'
                                tabIndex={-1}
                            />
                        );
                    }}
                </Draggable>
                <div className='SidebarCategory_newDropBox'>
                    <div
                        ref={this.newDropBoxRef}
                        className={classNames('SidebarCategory_newDropBox-content', {
                            collapsed: category.collapsed || (draggingState.type === DraggingStateTypes.CATEGORY && draggingState.id === category.id),
                            isDraggingOver,
                        })}
                        onTransitionEnd={this.removeAnimation}
                    >
                        <i className='icon-hand-right'/>
                        <span className='SidebarCategory_newDropBox-label'>
                            <FormattedMessage
                                id='sidebar_left.sidebar_category.newDropBoxLabel'
                                defaultMessage='Drag channels here...'
                            />
                        </span>
                    </div>
                </div>
            </React.Fragment>
        );
    };

    showPlaceholder = () => {
        const {channelIds, draggingState, category, isNewCategory} = this.props;

        if (category.sorting === CategorySorting.Alphabetical ||
            category.sorting === CategorySorting.Recency ||
            isNewCategory) {
            // Always show the placeholder if the channel being dragged is from the current category
            if (channelIds.find((id) => id === draggingState.id)) {
                return true;
            }

            return false;
        }

        return true;
    };

    render() {
        const {
            category,
            categoryIndex,
            channelIds,
            isNewCategory,
        } = this.props;

        if (!category) {
            return null;
        }

        if (category.type === CategoryTypes.FAVORITES && !channelIds?.length) {
            return null;
        }

        const renderedChannels = channelIds.map(this.renderChannel);

        let categoryMenu: JSX.Element;
        let newLabel: JSX.Element;
        let directMessagesModalButton: JSX.Element;
        let isCollapsible = true;
        if (isNewCategory) {
            newLabel = (
                <div className='SidebarCategory_newLabel'>
                    <FormattedMessage
                        id='sidebar_left.sidebar_category.newLabel'
                        defaultMessage='new'
                    />
                </div>
            );

            categoryMenu = <SidebarCategoryMenu category={category}/>;
        } else if (category.type === CategoryTypes.DIRECT_MESSAGES) {
            const addHelpLabel = localizeMessage('sidebar.createDirectMessage', 'Create new direct message');

            const addTooltip = (
                <Tooltip
                    id='new-group-tooltip'
                    className='hidden-xs'
                >
                    {addHelpLabel}
                    <KeyboardShortcutSequence
                        shortcut={KEYBOARD_SHORTCUTS.navDMMenu}
                        hideDescription={true}
                        isInsideTooltip={true}
                    />
                </Tooltip>
            );

            categoryMenu = (
                <React.Fragment>
                    <SidebarCategorySortingMenu
                        category={category}
                        handleOpenDirectMessagesModal={this.handleOpenDirectMessagesModal}
                    />
                    <OverlayTrigger
                        delayShow={500}
                        placement='top'
                        overlay={addTooltip}
                    >
                        <button
                            className='SidebarChannelGroupHeader_addButton'
                            onClick={this.handleOpenDirectMessagesModal}
                            aria-label={addHelpLabel}
                        >
                            <i className='icon-plus'/>
                        </button>
                    </OverlayTrigger>
                </React.Fragment>
            );

            if (!channelIds || !channelIds.length) {
                isCollapsible = false;
            }
        } else {
            categoryMenu = <SidebarCategoryMenu category={category}/>;
        }

        let displayName = category.display_name;
        if (category.type !== CategoryTypes.CUSTOM) {
            displayName = localizeMessage(`sidebar.types.${category.type}`, category.display_name);
        }

        return (
            <Draggable
                draggableId={category.id}
                index={categoryIndex}
                disableInteractiveElementBlocking={true}
            >
                {(provided, snapshot) => {
                    let inviteMembersButton = null;
                    if (category.type === 'direct_messages' && !category.collapsed) {
                        inviteMembersButton = (
                            <InviteMembersButton
                                className='followingSibling'
                                isAdmin={this.props.isAdmin}
                            />
                        );
                    }

                    let addChannelsCtaButton = null;
                    if (category.type === 'channels' && !category.collapsed) {
                        addChannelsCtaButton = (
                            <AddChannelsCtaButton/>
                        );
                    }

                    return (
                        <div
                            className={classNames('SidebarChannelGroup a11y__section', {
                                dropDisabled: this.isDropDisabled(),
                                menuIsOpen: this.state.isMenuOpen,
                                capture: this.props.draggingState.state === DraggingStates.CAPTURE,
                                isCollapsed: category.collapsed,
                            })}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                        >
                            <Droppable
                                droppableId={category.id}
                                type='SIDEBAR_CHANNEL'
                                isDropDisabled={this.isDropDisabled()}
                            >
                                {(droppableProvided, droppableSnapshot) => {
                                    return (
                                        <div
                                            {...droppableProvided.droppableProps}
                                            ref={droppableProvided.innerRef}
                                            className={classNames({
                                                draggingOver: droppableSnapshot.isDraggingOver,
                                            })}
                                        >
                                            <div
                                                className='sr-only'
                                                aria-live='polite'
                                                aria-atomic='true'
                                            >
                                                {(!category.collapsed) && (
                                                    <FormattedMessage
                                                        id='sidebar_left.sidebar_channel_menu.channel_count_aria_live'
                                                        defaultMessage='{count, number} {count, plural, one {channel} other {channels}}'
                                                        values={{count: category.channel_ids.length}}
                                                    />
                                                )}
                                            </div>
                                            <SidebarCategoryHeader
                                                ref={this.categoryTitleRef}
                                                displayName={displayName}
                                                dragHandleProps={provided.dragHandleProps}
                                                isCollapsed={category.collapsed}
                                                isCollapsible={isCollapsible}
                                                isDragging={snapshot.isDragging}
                                                isDraggingOver={droppableSnapshot.isDraggingOver}
                                                muted={category.muted}
                                                onClick={this.handleCollapse}
                                            >
                                                {newLabel}
                                                {directMessagesModalButton}
                                                {categoryMenu}
                                            </SidebarCategoryHeader>
                                            <div
                                                className={classNames('SidebarChannelGroup_content')}
                                            >
                                                <ul
                                                    role='list'
                                                    className='NavGroupContent'
                                                    aria-label={displayName}
                                                >
                                                    {this.renderNewDropBox(droppableSnapshot.isDraggingOver)}
                                                    {renderedChannels}
                                                    {this.showPlaceholder() ? droppableProvided.placeholder : null}
                                                </ul>
                                            </div>
                                        </div>
                                    );
                                }}
                            </Droppable>
                            {inviteMembersButton}
                            {addChannelsCtaButton}
                        </div>
                    );
                }}
            </Draggable>
        );
    }
}

// Adding references to translations for i18n-extract
t('sidebar.types.channels');
t('sidebar.types.direct_messages');
t('sidebar.types.favorites');
