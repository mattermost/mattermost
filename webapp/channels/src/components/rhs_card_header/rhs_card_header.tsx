// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl, type IntlShape} from 'react-intl';

import {
    ArrowBackIosIcon,
    ArrowCollapseIcon,
    ArrowExpandIcon,
    CloseIcon,
} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

import {RHSStates} from 'utils/constants';

import type {RhsState} from 'types/store/rhs';

type Props = {
    intl: IntlShape;
    previousRhsState?: RhsState;
    isExpanded: boolean;
    actions: {
        showMentions: () => void;
        showSearchResults: () => void;
        showFlaggedPosts: () => void;
        showPinnedPosts: () => void;
        closeRightHandSide: () => void;
        toggleRhsExpanded: () => void;
    };
};

class RhsCardHeader extends React.PureComponent<Props> {
    handleBack = (e: React.MouseEvent<HTMLButtonElement>): void => {
        e.preventDefault();

        switch (this.props.previousRhsState) {
        case RHSStates.CHANNEL_FILES:
            this.props.actions.showSearchResults();
            break;
        case RHSStates.SEARCH:
            this.props.actions.showSearchResults();
            break;
        case RHSStates.MENTION:
            this.props.actions.showMentions();
            break;
        case RHSStates.FLAG:
            this.props.actions.showFlaggedPosts();
            break;
        case RHSStates.PIN:
            this.props.actions.showPinnedPosts();
            break;
        default:
            break;
        }
    };

    render(): React.ReactNode {
        let back;
        let title;

        switch (this.props.previousRhsState) {
        case RHSStates.SEARCH:
        case RHSStates.MENTION:
            title = (
                <FormattedMessage
                    id='rhs_header.backToResultsTooltip'
                    defaultMessage='Back to search results'
                />
            );
            break;
        case RHSStates.FLAG:
            title = (
                <FormattedMessage
                    id='rhs_header.backToFlaggedTooltip'
                    defaultMessage='Back to saved messages'
                />
            );
            break;
        case RHSStates.PIN:
            title = (
                <FormattedMessage
                    id='rhs_header.backToPinnedTooltip'
                    defaultMessage='Back to pinned messages'
                />
            );
            break;
        }

        const expandSidebarTooltip = (
            <>
                <FormattedMessage
                    id='rhs_header.expandSidebarTooltip'
                    defaultMessage='Expand the right sidebar'
                />
                <KeyboardShortcutSequence
                    shortcut={KEYBOARD_SHORTCUTS.navExpandSidebar}
                    hideDescription={true}
                    isInsideTooltip={true}
                />
            </>
        );

        const shrinkSidebarTooltip = (
            <>
                <FormattedMessage
                    id='rhs_header.collapseSidebarTooltip'
                    defaultMessage='Collapse the right sidebar'
                />
                <KeyboardShortcutSequence
                    shortcut={KEYBOARD_SHORTCUTS.navExpandSidebar}
                    hideDescription={true}
                    isInsideTooltip={true}
                />
            </>
        );

        if (title) {
            back = (
                <WithTooltip
                    title={title}
                >
                    <IconButton
                        size='small'
                        className='sidebar--right__back'
                        icon={<Icon glyph={<ArrowBackIosIcon/>}/>}
                        onClick={this.handleBack}
                        aria-label={this.props.intl.formatMessage({id: 'rhs_header.back.icon', defaultMessage: 'Back Icon'})}
                    />
                </WithTooltip>
            );
        }

        const collapseIconLabel = this.props.intl.formatMessage({id: 'rhs_header.collapseSidebarTooltip.icon', defaultMessage: 'Collapse Sidebar Icon'});
        const expandIconLabel = this.props.intl.formatMessage({id: 'rhs_header.expandSidebarTooltip.icon', defaultMessage: 'Expand Sidebar Icon'});

        return (
            <div className='sidebar--right__header'>
                <span
                    className='sidebar--right__title'
                    id='rhsPanelTitle'
                >
                    {back}
                    <FormattedMessage
                        id='search_header.title5'
                        defaultMessage='Extra Information'
                    />
                </span>
                <div className='pull-right'>
                    <WithTooltip
                        title={this.props.isExpanded ? shrinkSidebarTooltip : expandSidebarTooltip}
                    >
                        <IconButton
                            size='small'
                            className='sidebar--right__expand'
                            icon={<Icon glyph={this.props.isExpanded ? <ArrowCollapseIcon/> : <ArrowExpandIcon/>}/>}
                            aria-label={this.props.isExpanded ? collapseIconLabel : expandIconLabel}
                            onClick={this.props.actions.toggleRhsExpanded}
                        />
                    </WithTooltip>
                    <WithTooltip
                        title={
                            <FormattedMessage
                                id='rhs_header.closeSidebarTooltip'
                                defaultMessage='Close'
                            />
                        }
                    >
                        <IconButton
                            size='small'
                            className='sidebar--right__close'
                            icon={<Icon glyph={<CloseIcon/>}/>}
                            aria-label={this.props.intl.formatMessage({id: 'rhs_header.closeTooltip.icon', defaultMessage: 'Close Sidebar Icon'})}
                            onClick={this.props.actions.closeRightHandSide}
                        />
                    </WithTooltip>
                </div>
            </div>
        );
    }
}

export default injectIntl(RhsCardHeader);
