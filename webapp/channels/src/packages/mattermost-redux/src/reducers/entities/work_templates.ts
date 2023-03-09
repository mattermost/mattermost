// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {GenericAction} from 'mattermost-redux/types/actions';
import {PlaybookType, WorkTemplatesType} from 'mattermost-redux/action_types';

import {Category, WorkTemplate} from '@mattermost/types/work_templates';

function categories(state: Category[] = [], action: GenericAction): Category[] {
    switch (action.type) {
    case WorkTemplatesType.RECEIVED_WORK_TEMPLATE_CATEGORIES: {
        return [...state, ...action.data];
    }
    case WorkTemplatesType.CLEAR_WORK_TEMPLATE_CATEGORIES: {
        return [];
    }
    default:
        return state;
    }
}

function templatesInCategory(state: Record<string, WorkTemplate[]> = {}, action: GenericAction): Record<string, WorkTemplate[]> {
    switch (action.type) {
    case WorkTemplatesType.RECEIVED_WORK_TEMPLATES: {
        const nextState: Record<string, WorkTemplate[]> = {...state};
        const data = action.data as WorkTemplate[];
        const categoryIds = data.
            map((template) => template.category).
            filter((category, index, self) => self.indexOf(category) === index);

        categoryIds.forEach((categoryId) => {
            nextState[categoryId] = [];
            data.forEach((template) => {
                if (template.category === categoryId) {
                    nextState[categoryId].push(template);
                }
            });
        });
        return nextState;
    }
    case WorkTemplatesType.CLEAR_WORK_TEMPLATES: {
        return {};
    }
    default:
        return state;
    }
}

function playbookTemplates(state: [] = [], action: GenericAction) {
    switch (action.type) {
    case PlaybookType.PLAYBOOKS_PUBLISH_TEMPLATES:
        return action.templates;
    default:
        return state;
    }
}

function linkedProducts(state: Record<string, number> = {}, action: GenericAction) {
    switch (action.type) {
    case WorkTemplatesType.EXECUTE_SUCCESS: {
        return {
            ...action.data,
        };
    }
    default:
        return state;
    }
}

export default (combineReducers({
    categories,
    templatesInCategory,
    playbookTemplates,
    linkedProducts,
}));

