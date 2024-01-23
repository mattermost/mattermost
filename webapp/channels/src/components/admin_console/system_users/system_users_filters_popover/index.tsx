// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {autoUpdate, useClick, useDismiss, useFloating, useInteractions, useRole, FloatingFocusManager, useTransitionStyles, autoPlacement, offset} from '@floating-ui/react';
import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import {StyledPopoverContainer} from 'components/styled_popover_container';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import {SystemUsersFiltersStatus} from './styled_users_filters_status';

import './system_users_filter_popover.scss';

interface Props {
    filterStatus: AdminConsoleUserManagementTableProperties['filterStatus'];
}

export function SystemUsersFilterPopover(props: Props) {
    const [isPopoverOpen, setPopoverOpen] = useState(false);

    const {formatMessage} = useIntl();

    const {context: floatingContext, refs: floatingRefs, floatingStyles} = useFloating({
        open: isPopoverOpen,
        onOpenChange: setPopoverOpen,
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(10),
            autoPlacement({
                allowedPlacements: ['bottom-start', 'top-start'],
            }),
        ],
    });

    const {isMounted, styles: floatingTransistionStyles} = useTransitionStyles(floatingContext);

    const floatingContextClick = useClick(floatingContext);
    const floatingContextDismiss = useDismiss(floatingContext);
    const floatingContextRole = useRole(floatingContext);

    const {getReferenceProps, getFloatingProps} = useInteractions([
        floatingContextClick,
        floatingContextDismiss,
        floatingContextRole,
    ]);

    const filterStatusApplied = props.filterStatus.length > 0 ? 1 : 0;
    const filtersCount = filterStatusApplied;

    return (
        <div className='systemUsersFilterContainer'>
            <button
                {...getReferenceProps()}
                ref={floatingRefs.setReference}
                className='btn btn-md btn-tertiary'
                aria-controls='systemUsersFilterPopover'
            >
                <i className='icon icon-filter-variant'/>
                {formatMessage({id: 'admin.system_users.filtersMenu', defaultMessage: 'Filters ({count})'}, {count: filtersCount})}
            </button>
            {isMounted && (
                <FloatingFocusManager
                    context={floatingContext}
                >
                    <StyledPopoverContainer
                        {...getFloatingProps()}
                        id='systemUsersFilterPopover'
                        ref={floatingRefs.setFloating}
                        style={Object.assign({}, floatingStyles, floatingTransistionStyles)}
                        className='systemUsersFilterPopoverContainer'
                        aria-labelledby='systemUsersFilterPopoverTitle'
                    >
                        <div id='systemUsersFilterPopoverTitle'>
                            {formatMessage({id: 'admin.system_users.filtersPopover.title', defaultMessage: 'Filter by'})}
                        </div>
                        <div className='systemUsersFilterPopoverBody'>
                            <SystemUsersFiltersStatus
                                value={props.filterStatus}
                            />
                        </div>
                    </StyledPopoverContainer>
                </FloatingFocusManager>
            )}
        </div>
    );
}
