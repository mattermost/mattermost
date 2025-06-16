// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MuiPopover from '@mui/material/Popover';
import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {Permissions} from 'mattermost-redux/constants';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import CompassDesignProvider from 'components/compass_design_provider';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';

import {A11yClassNames} from 'utils/constants';

import {ActionsMenuIcon} from './actions_menu_icon';

const OPEN_ANIMATION_DURATION = 150;
const CLOSE_ANIMATION_DURATION = 100;

type Props = {
    anchorElement: Element | null | undefined;
    handleClose: () => void;
    handleOpenMarketplace: () => void;
    isOpen: boolean;
}

export default function ActionsMenuEmptyPopover({
    anchorElement,
    handleClose,
    handleOpenMarketplace,
    isOpen,
}: Props) {
    const theme = useSelector(getTheme);

    return (
        <CompassDesignProvider theme={theme}>
            <MuiPopover
                anchorEl={anchorElement}
                open={isOpen}
                onClose={handleClose}
                className={classNames(A11yClassNames.POPUP, 'ActionsMenuEmptyPopover')}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                marginThreshold={0}
                TransitionProps={{
                    mountOnEnter: true,
                    unmountOnExit: true,
                    timeout: {
                        enter: OPEN_ANIMATION_DURATION,
                        exit: CLOSE_ANIMATION_DURATION,
                    },
                }}
                role='dialog'
                aria-modal={true}
                aria-labelledby={anchorElement?.id}
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
                            onClick={handleOpenMarketplace}
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
            </MuiPopover>
        </CompassDesignProvider>
    );
}
