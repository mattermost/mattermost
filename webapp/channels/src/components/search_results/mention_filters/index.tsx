// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    FloatingFocusManager,
    FloatingPortal,
    autoUpdate,
    flip,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
    useTransitionStatus,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {FilterVariantIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';

import {getIsCrossTeamSearchEnabled} from 'mattermost-redux/selectors/entities/general';
import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {updateMentionFilters} from 'actions/views/rhs';
import {getExplicitSearchTeam, getMentionFilters} from 'selectors/rhs';

import {RootHtmlPortalId} from 'utils/constants';
import {countMentionFilters} from 'utils/mention_search';

import type {MentionFilters} from 'types/store/rhs';

import MentionFiltersPopover from './mention_filters_popover';

import './mention_filters.scss';

export {default as MentionFilterChips} from './mention_filter_chips';

// Matches Compass's --duration-quick, which the popover's CSS transition uses.
const POPOVER_TRANSITION_MS = 150;

export default function MentionFiltersButton() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [isOpen, setIsOpen] = useState(false);
    const [openCount, setOpenCount] = useState(0);

    const filters = useSelector(getMentionFilters);
    const teamId = useSelector(getExplicitSearchTeam);
    const myTeams = useSelector(getMyTeams);
    const crossTeamSearchEnabled = useSelector(getIsCrossTeamSearchEnabled);

    const showTeamSelector = crossTeamSearchEnabled && myTeams.length > 1;
    const count = countMentionFilters(filters, teamId);

    // Closing by clicking away should not move focus back to the button: doing so by script makes
    // the button flash its keyboard focus ring. Floating UI reads this ref when the popover unmounts.
    const returnFocusRef = useRef<HTMLElement | null>(null);

    const handleOpenChange = useCallback((open: boolean, _event?: Event, reason?: string) => {
        if (!open && reason === 'outside-press') {
            returnFocusRef.current = null;
        }
        if (open) {
            setOpenCount((previous) => previous + 1);
        }
        setIsOpen(open);
    }, []);

    const {refs, floatingStyles, context} = useFloating({
        open: isOpen,
        onOpenChange: handleOpenChange,
        placement: 'bottom-start',
        middleware: [offset(4), flip(), shift({padding: 8})],
        whileElementsMounted: autoUpdate,
    });

    const {isMounted, status} = useTransitionStatus(context, {duration: POPOVER_TRANSITION_MS});

    useEffect(() => {
        if (isOpen) {
            returnFocusRef.current = refs.domReference.current as HTMLElement | null;
        }
    }, [isOpen, refs.domReference]);

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useClick(context),
        useDismiss(context, {escapeKey: false}),
        useRole(context, {role: 'dialog'}),
    ]);

    // Escape closes an open Combobox menu first and only closes the popover on the next press.
    // The check runs in the capture phase, before the Combobox handles the key and closes its menu.
    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.isComposing) {
                return;
            }
            const menuOpen = refs.floating.current?.querySelector('[role="combobox"][aria-expanded="true"]');
            if (!menuOpen) {
                setIsOpen(false);
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [isOpen, refs.floating]);

    const onApply = useCallback((nextFilters: MentionFilters, nextTeamId: string | null) => {
        dispatch(updateMentionFilters(nextFilters, nextTeamId));
    }, [dispatch]);

    return (
        <>
            <Button
                id='mentionFiltersButton'
                data-testid='mentionFiltersButton'
                ref={refs.setReference}
                className='MentionFilters__trigger'
                emphasis='quaternary'
                size='small'
                leadingIcon={<Icon glyph={<FilterVariantIcon/>}/>}
                aria-label={formatMessage({id: 'search_results.mention_filters.button', defaultMessage: 'Filters'})}
                {...getReferenceProps()}
            >
                {count > 0 ? (
                    <FormattedMessage
                        id='search_results.mention_filters.button_with_count'
                        defaultMessage='Filters ({count})'
                        values={{count}}
                    />
                ) : (
                    <FormattedMessage
                        id='search_results.mention_filters.button'
                        defaultMessage='Filters'
                    />
                )}
            </Button>
            {isMounted && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingFocusManager
                        context={context}
                        modal={false}
                        initialFocus={-1}
                        returnFocus={returnFocusRef}
                    >
                        <div
                            ref={refs.setFloating}
                            style={floatingStyles}
                            className='MentionFilters__floating'
                            data-testid='mentionFiltersPopover'
                            {...getFloatingProps()}
                        >
                            <div
                                className={classNames('MentionFilters', {'MentionFilters--visible': status === 'open'})}
                                style={{transformOrigin: context.placement.startsWith('top') ? 'bottom right' : 'top right'}}
                            >
                                <MentionFiltersPopover
                                    key={openCount}
                                    filters={filters}
                                    teamId={teamId}
                                    showTeamSelector={showTeamSelector}
                                    onApply={onApply}
                                    onClose={() => setIsOpen(false)}
                                />
                            </div>
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
}
