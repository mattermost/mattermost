// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WorkTemplatesType} from 'mattermost-redux/action_types';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {bindClientFunc} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';

import {ExecuteWorkTemplateRequest} from '@mattermost/types/work_templates';

export function getWorkTemplateCategories(): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getWorkTemplateCategories,
        onRequest: WorkTemplatesType.WORK_TEMPLATE_CATEGORIES_REQUEST,
        onSuccess: [WorkTemplatesType.RECEIVED_WORK_TEMPLATE_CATEGORIES],
    });
}

export function getWorkTemplates(categoryId: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getWorkTemplates,
        onRequest: WorkTemplatesType.WORK_TEMPLATES_REQUEST,
        onSuccess: [WorkTemplatesType.RECEIVED_WORK_TEMPLATES],
        params: [categoryId],
    });
}

export function executeWorkTemplate(req: ExecuteWorkTemplateRequest): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.executeWorkTemplate,
        params: [req],
    });
}

export function clearCategories(): ActionFunc {
    return async (dispatch) => {
        dispatch({type: WorkTemplatesType.CLEAR_WORK_TEMPLATE_CATEGORIES});
        return [];
    };
}

export function clearWorkTemplates(): ActionFunc {
    return async (dispatch) => {
        dispatch({type: WorkTemplatesType.CLEAR_WORK_TEMPLATES});
        return [];
    };
}

// stores the linked product information in the state so it can be used to show the tourtip
export function onExecuteSuccess(data: Record<string, number>): ActionFunc {
    return async (dispatch) => {
        dispatch({type: WorkTemplatesType.EXECUTE_SUCCESS, data});
        return [];
    };
}
