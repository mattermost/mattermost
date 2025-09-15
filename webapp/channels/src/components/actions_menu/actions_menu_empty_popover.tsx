// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Permissions} from 'mattermost-redux/constants';

import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';

import {ActionsMenuIcon} from './actions_menu_icon';
import Popover from './popover';

type Props = {
    anchorElement: Element | null | undefined;
    onOpenMarketplace: () => void;
    onToggle: (open: boolean) => void;
    isOpen: boolean;
}

export default function ActionsMenuEmptyPopover({
    anchorElement,
    onOpenMarketplace,
    onToggle,
    isOpen,
}: Props) {
    return (
        <Popover
            anchorElement={anchorElement}
            isOpen={isOpen}
            onToggle={onToggle}

            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
        >
            <SystemPermissionGate
                permissions={[Permissions.MANAGE_SYSTEM]}
                key='visit-marketplace-permissions'
            >
                <div className='visit-marketplace-text'>
                    <p>
                        <FormattedMessage
                            id='post_info.actions.noActions.first_line'
                            defaultMessage='No Actions currently'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='post_info.actions.noActions.second_line'
                            defaultMessage='configured for this server'
                        />
                    </p>
                </div>
                <div className='visit-marketplace'>
                    <button
                        id='marketPlaceButton'
                        className='btn btn-primary btn-sm visit-marketplace-button'
                        onClick={onOpenMarketplace}
                    >
                        <ActionsMenuIcon name='icon-view-grid-plus-outline'/>
                        <span className='visit-marketplace-button-text'>
                            <FormattedMessage
                                id='post_info.actions.visitMarketplace'
                                defaultMessage='Visit the Marketplace'
                            />
                        </span>
                    </button>
                </div>
            </SystemPermissionGate>
        </Popover>
    );
}
