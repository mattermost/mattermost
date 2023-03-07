// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RequireOnlyOne} from './utilities';

export type WorkTemplatesState = {
    categories: Category[];
    templatesInCategory: Record<string, WorkTemplate[]>;
    playbookTemplates: PlaybookTemplateType[];
    linkedProducts: Record<string, number>;
}

export interface PlaybookTemplateType {
    title: string;
    template: any;
}

export interface ExecuteWorkTemplateRequest {
    team_id: string;
    name: string;
    visibility: Visibility;
    work_template: WorkTemplate;
    playbook_templates?: PlaybookTemplateType[];
}

export interface ExecuteWorkTemplateResponse {
    channel_with_playbook_ids: string[];
    channel_ids: string[];
}

export interface WorkTemplate {
    id: string;
    category: string;
    useCase: string;
    description: Description;
    illustration: string;
    visibility: Visibility;
    content: ValidContent[];
}

export const categories = ['product', 'devops', 'company_wide', 'leadership', 'design'];
export interface Category {
    id: typeof categories[number];
    name: string;
}

export interface Channel {
    id: string;
    name: string;
    illustration: string;
    playbook?: string;
}
export interface Board {
    id: string;
    name: string;
    illustration: string;
    channel?: string;
}
export interface Playbook {
    id: string;
    name: string;
    illustration: string;
    template: string;
}
export interface Integration {
    id: string;
    name?: string;
    icon?: string;
    installed?: boolean;
}

interface Content {
    channel?: Channel;
    board?: Board;
    playbook?: Playbook;
    integration?: Integration;
}

type ValidContent = RequireOnlyOne<Content, 'channel' | 'board' | 'playbook' | 'integration'>;

export interface MessageWithIllustration {
    message: string;
    illustration?: string;
}
type MessageWithMandatoryIllustration = Partial<MessageWithIllustration> & Required<Pick<MessageWithIllustration, 'illustration'>>;

interface Description {
    channel: MessageWithIllustration;
    board: MessageWithIllustration;
    playbook: MessageWithIllustration;
    integration: MessageWithMandatoryIllustration;
}

export enum Visibility {
    Public = 'public',
    Private = 'private',
}
