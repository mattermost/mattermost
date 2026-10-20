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
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {FilterVariantIcon} from '@mattermost/compass-icons/components';

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

export default function MentionFiltersButton() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [isOpen, setIsOpen] = useState(false);

    const filters = useSelector(getMentionFilters);
    const teamId = useSelector(getExplicitSearchTeam);
    const myTeams = useSelector(getMyTeams);
    const crossTeamSearchEnabled = useSelector(getIsCrossTeamSearchEnabled);

    const showTeamSelector = crossTeamSearchEnabled && myTeams.length > 1;
    const count = countMentionFilters(filters, teamId);

    const {refs, floatingStyles, context} = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-start',
        middleware: [offset(4), flip(), shift({padding: 8})],
        whileElementsMounted: autoUpdate,
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useClick(context),
        useDismiss(context),
        useRole(context, {role: 'dialog'}),
    ]);

    const onApply = useCallback((nextFilters: MentionFilters, nextTeamId: string | null) => {
        dispatch(updateMentionFilters(nextFilters, nextTeamId));
    }, [dispatch]);

    return (
        <>
            <button
                type='button'
                id='mentionFiltersButton'
                data-testid='mentionFiltersButton'
                ref={refs.setReference}
                className={classNames('MentionFilters__button', {'MentionFilters__button--active': isOpen || count > 0})}
                aria-label={formatMessage({id: 'search_results.mention_filters.button', defaultMessage: 'Filters'})}
                {...getReferenceProps()}
            >
                <FilterVariantIcon size={16}/>
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
            </button>
            {isOpen && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingFocusManager
                        context={context}
                        modal={false}
                    >
                        <div
                            ref={refs.setFloating}
                            style={floatingStyles}
                            className='MentionFilters'
                            data-testid='mentionFiltersPopover'
                            {...getFloatingProps()}
                        >
                            <MentionFiltersPopover
                                filters={filters}
                                teamId={teamId}
                                showTeamSelector={showTeamSelector}
                                onApply={onApply}
                                onClose={() => setIsOpen(false)}
                            />
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
}
