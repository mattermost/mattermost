// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {DotsVerticalIcon} from '@mattermost/compass-icons/components';

import DotMenu from 'src/components/dot_menu';
import {Separator} from 'src/components/backstage/playbook_runs/shared';

import {DotMenuButtonStyled} from './shared';
import {CopyPlaybookLinkMenuItem, FavoritePlaybookMenuItem, LeavePlaybookMenuItem} from './playbook_editor/controls';

interface Props {
    playbookId: string;
    isFavorite: boolean;
}

export const LHSPlaybookDotMenu = ({playbookId, isFavorite}: Props) => {
    return (
        <>
            <DotMenu
                placement='bottom-start'
                icon={(
                    <DotsVerticalIcon
                        size={14.4}
                        color={'var(--button-color)'}
                    />
                )}
                dotMenuButton={DotMenuButtonStyled}
            >
                <FavoritePlaybookMenuItem
                    playbookId={playbookId}
                    isFavorite={isFavorite}
                />
                <CopyPlaybookLinkMenuItem playbookId={playbookId}/>
                <Separator/>
                <LeavePlaybookMenuItem playbookId={playbookId}/>
            </DotMenu>
        </>
    );
};
