// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ViewGridPlusOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';

import {Permissions} from 'mattermost-redux/constants';

import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';

import Popover from './popover';

type Props = {
    anchorElement: Element | null | undefined;
    onOpenMarketplace: () => void;
    onToggle: (open: boolean) => void;
    isOpen: boolean;
};

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
                    <Button
                        id='marketPlaceButton'
                        emphasis='primary'
                        size='small'
                        className='visit-marketplace-button'
                        onClick={onOpenMarketplace}
                        leadingIcon={<Icon glyph={<ViewGridPlusOutlineIcon/>}/>}
                    >
                        <span className='visit-marketplace-button-text'>
                            <FormattedMessage
                                id='post_info.actions.visitMarketplace'
                                defaultMessage='Visit the Marketplace'
                            />
                        </span>
                    </Button>
                </div>
            </SystemPermissionGate>
        </Popover>
    );
}
