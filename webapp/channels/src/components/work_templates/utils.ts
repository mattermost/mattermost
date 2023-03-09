// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaybookTemplateType, WorkTemplate} from '@mattermost/types/work_templates';

export function getTemplateDefaultIllustration(template: WorkTemplate): string {
    const channels = template.content.filter((c) => c.channel).map((c) => c.channel!);
    if (channels.length) {
        return channels[0].illustration;
    }
    if (template.description.channel.illustration) {
        return template.description.channel.illustration;
    }

    const boards = template.content.filter((c) => c.board).map((c) => c.board!);
    if (boards.length) {
        return boards[0].illustration;
    }
    if (template.description.board.illustration) {
        return template.description.board.illustration;
    }

    const playbooks = template.content.filter((c) => c.playbook).map((c) => c.playbook!);
    if (playbooks.length) {
        return playbooks[0].illustration;
    }
    if (template.description.playbook.illustration) {
        return template.description.playbook.illustration;
    }

    return '';
}

export const getContentCount = (template: WorkTemplate, playbookTemplates: PlaybookTemplateType[]) => {
    const res = {
        playbooks: 0,
        boards: 0,
    };
    for (const item of template.content) {
        if (item.playbook) {
            const pbTemplate = playbookTemplates.find((pb) => pb.title === item.playbook.template);
            if (pbTemplate) {
                res.playbooks++;
            }
        } else if (item.board) {
            res.boards++;
        }
    }

    return res;
};
