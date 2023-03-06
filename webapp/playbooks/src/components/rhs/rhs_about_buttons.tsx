// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {NotebookOutlineIcon, PencilOutlineIcon, PlayOutlineIcon} from '@mattermost/compass-icons/components';

import {PlaybookRun} from 'src/types/playbook_run';
import {navigateToPluginUrl} from 'src/browser_routing';
import {HoverMenuButton} from 'src/components/rhs/rhs_shared';
import DotMenu, {DotMenuButton, DropdownMenuItem} from 'src/components/dot_menu';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';
import {usePlaybookName} from 'src/hooks';

interface Props {
    playbookRun: PlaybookRun;
    collapsed: boolean;
    toggleCollapsed: () => void;
    editSummary: () => void;
    readOnly?: boolean;
}

const RHSAboutButtons = (props: Props) => {
    const {formatMessage} = useIntl();
    const playbookName = usePlaybookName(props.playbookRun.playbook_id);

    const overviewURL = `/runs/${props.playbookRun.id}?from=channel_rhs_dotmenu`;
    const playbookURL = `/playbooks/${props.playbookRun.playbook_id}`;

    return (
        <>
            <ExpandCollapseButton
                title={props.collapsed ? formatMessage({defaultMessage: 'Expand'}) : formatMessage({defaultMessage: 'Collapse'})}
                className={(props.collapsed ? 'icon-chevron-down' : 'icon-chevron-up') + ' icon-16 btn-icon'}
                tabIndex={0}
                role={'button'}
                onClick={props.toggleCollapsed}
                onKeyDown={(e) => {
                    // Handle Enter and Space as clicking on the button
                    if (e.keyCode === 13 || e.keyCode === 32) {
                        props.toggleCollapsed();
                    }
                }}
            />
            <DotMenu
                icon={<ThreeDotsIcon/>}
                placement='bottom-end'
                dotMenuButton={StyledDotMenuButton}
                data-testid='run-dot-menu'
                title={formatMessage({defaultMessage: 'More'})}
                portal={false}
                focusManager={{returnFocus: false}}
            >
                {!props.readOnly &&
                <>
                    <StyledDropdownMenuItem
                        onClick={() => {
                            props.editSummary();
                        }}
                    >
                        <IconWrapper>
                            <PencilOutlineIcon size={20}/>
                        </IconWrapper>
                        <FormattedMessage defaultMessage='Edit run summary'/>
                    </StyledDropdownMenuItem>
                    <Separator/>
                </>
                }
                <StyledDropdownMenuItem onClick={() => navigateToPluginUrl(overviewURL)}>
                    <IconWrapper>
                        <PlayOutlineIcon size={22}/>
                    </IconWrapper>
                    <FormattedMessage defaultMessage='Go to run overview'/>
                </StyledDropdownMenuItem>
                <StyledDropdownMenuItem onClick={() => navigateToPluginUrl(playbookURL)}>
                    <IconWrapper>
                        <NotebookOutlineIcon size={20}/>
                    </IconWrapper>
                    <PlaybookInfo>
                        <FormattedMessage defaultMessage='Go to playbook'/>
                        {(playbookName !== '') && <PlaybookName>{playbookName}</PlaybookName>}
                    </PlaybookInfo>
                </StyledDropdownMenuItem>
            </DotMenu>
        </>
    );
};

const StyledDotMenuButton = styled(DotMenuButton)`
    width: 28px;
    height: 28px;
`;

const ExpandCollapseButton = styled(HoverMenuButton)`
    margin-left: 2px;
`;

const ThreeDotsIcon = styled(HamburgerButton)`
    font-size: 18px;
    margin-left: 1px;
`;

const IconWrapper = styled.div`
    margin-right: 11px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const StyledDropdownMenuItem = styled(DropdownMenuItem)`
    display: flex;
    align-content: center;
`;

const Separator = styled.hr`
    display: flex;
    align-content: center;
    border-top: 1px solid var(--center-channel-color-08);
    margin: 5px auto;
    width: 100%;
`;

const PlaybookInfo = styled.div`
    display: flex;
    flex-direction: column;
`;

const PlaybookName = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;

    max-width: 162px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export default RHSAboutButtons;
