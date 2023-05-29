// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction, Dispatch} from 'redux';
import qs from 'qs';

import {GetStateFunc} from 'mattermost-redux/types/actions';
import {IntegrationTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {ClientError} from '@mattermost/client';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {
    FetchPlaybookRunsParams,
    FetchPlaybookRunsReturn,
    Metadata,
    PlaybookRun,
    RunMetricData,
    StatusPostComplete,
} from 'src/types/playbook_run';

import {setTriggerId} from 'src/actions';
import {OwnerInfo} from 'src/types/backstage';
import {
    PlaybookRunEventTarget,
    PlaybookRunViewTarget,
    TelemetryEventTarget,
    TelemetryViewTarget,
} from 'src/types/telemetry';
import {
    Checklist,
    ChecklistItem,
    ChecklistItemState,
    DraftPlaybookWithChecklist,
    FetchPlaybooksParams,
    FetchPlaybooksReturn,
    Playbook,
    PlaybookWithChecklist,
} from 'src/types/playbook';
import {AdminNotificationType} from 'src/constants';
import {ChannelAction} from 'src/types/channel_actions';
import {EmptyPlaybookStats, PlaybookStats, SiteStats} from 'src/types/stats';

import {pluginId} from './manifest';
import {GlobalSettings, globalSettingsSetDefaults} from './types/settings';
import {Category} from './types/category';
import {InsightsResponse} from './types/insights';

let siteURL = '';
let basePath = '';
let apiUrl = `${basePath}/plugins/${pluginId}/api/v0`;

export const setSiteUrl = (url?: string): void => {
    if (url) {
        basePath = new URL(url).pathname.replace(/\/+$/, '');
        siteURL = url;
    } else {
        basePath = '';
        siteURL = '';
    }

    apiUrl = `${basePath}/plugins/${pluginId}/api/v0`;
};

export const getSiteUrl = (): string => {
    return siteURL;
};

export const getApiUrl = (): string => {
    return apiUrl;
};

export async function fetchPlaybookRuns(params: FetchPlaybookRunsParams) {
    const queryParams = qs.stringify(params, {addQueryPrefix: true, indices: false});

    let data = await doGet(`${apiUrl}/runs${queryParams}`);
    if (!data) {
        data = {items: [], total_count: 0, page_count: 0, has_more: false} as FetchPlaybookRunsReturn;
    }

    return data as FetchPlaybookRunsReturn;
}

export async function fetchPlaybookRun(id: string) {
    const data = await doGet(`${apiUrl}/runs/${id}`);

    return data as PlaybookRun;
}

export async function fetchPlaybookRunStatusUpdates(id: string) {
    return doGet<StatusPostComplete[]>(`${apiUrl}/runs/${id}/status-updates`);
}

export async function createPlaybookRun(
    playbook_id: string,
    owner_user_id: string,
    team_id: string,
    name: string,
    description: string,
    channel_id?: string,
    create_public_run?: boolean
) {
    const run = await doPost(`${apiUrl}/runs`, JSON.stringify({
        owner_user_id,
        team_id,
        name,
        description,
        playbook_id,
        channel_id,
        create_public_run,
    }));
    return run as PlaybookRun;
}

export async function postStatusUpdate(
    playbookRunId: string,
    payload: {
        message: string,
        reminder?: number,
        finishRun: boolean,
    },
    ids: {
        user_id: string,
        channel_id: string,
        team_id: string,
    },
) {
    const base = {
        type: 'dialog_submission',
        callback_id: '',
        state: '',
        cancelled: false,
    };

    const body = JSON.stringify({
        ...base,
        ...ids,
        submission: {
            ...payload,
            reminder: payload.reminder?.toFixed() ?? '',
            finish_run: payload.finishRun,
        },
    });

    try {
        const data = await doPost(`${apiUrl}/runs/${playbookRunId}/update-status-dialog`, body);
        return data;
    } catch (error) {
        return {error};
    }
}

export async function fetchPlaybookRunMetadata(id: string) {
    const data = await doGet<Metadata>(`${apiUrl}/runs/${id}/metadata`);

    return data;
}

export async function fetchPlaybookRunByChannel(channelId: string) {
    const data = await doGet(`${apiUrl}/runs/channel/${channelId}`);

    return data as PlaybookRun;
}

export async function fetchPlaybookRunsForChannelByUser(channelId: string) {
    const data = await doGet(`${apiUrl}/runs/channel/${channelId}/runs`);

    return data as PlaybookRun[];
}

export async function fetchCheckAndSendMessageOnJoin(channelId: string) {
    const data = await doGet(`${apiUrl}/actions/channels/${channelId}/check-and-send-message-on-join`);
    return Boolean(data.viewed);
}

export function fetchPlaybookRunChannels(teamID: string, userID: string) {
    return doGet(`${apiUrl}/runs/channels?team_id=${teamID}&participant_id=${userID}`);
}

export async function clientExecuteCommand(dispatch: Dispatch<AnyAction>, getState: GetStateFunc, command: string, teamId: string) {
    let currentChannel = getCurrentChannel(getState());

    // Default to town square if there is no current channel (i.e., if Mattermost has not yet loaded)
    // or in a different team.
    if (!currentChannel || currentChannel.team_id !== teamId) {
        currentChannel = await Client4.getChannelByName(teamId, 'town-square');
    }

    const args = {
        channel_id: currentChannel?.id,
        team_id: teamId,
    };

    try {
        const data = await Client4.executeCommand(command, args);
        dispatch(setTriggerId(data?.trigger_id));
    } catch (error) {
        console.error(error); //eslint-disable-line no-console
    }
}

export async function clientRunChecklistItemSlashCommand(dispatch: Dispatch, playbookRunId: string, checklistNumber: number, itemNumber: number) {
    try {
        const data = await doPost(`${apiUrl}/runs/${playbookRunId}/checklists/${checklistNumber}/item/${itemNumber}/run`);
        if (data.trigger_id) {
            dispatch({type: IntegrationTypes.RECEIVED_DIALOG_TRIGGER_ID, data: data.trigger_id});
        }
    } catch (error) {
        console.error(error); //eslint-disable-line no-console
    }
}

export function clientFetchPlaybooks(teamID: string, params: FetchPlaybooksParams) {
    const queryParams = qs.stringify({
        team_id: teamID,
        ...params,
    }, {addQueryPrefix: true});
    return doGet<FetchPlaybooksReturn>(`${apiUrl}/playbooks${queryParams}`);
}

export const clientHasPlaybooks = async (teamID: string): Promise<boolean> => {
    const result = await clientFetchPlaybooks(teamID, {
        page: 0,
        per_page: 1,
    }) as FetchPlaybooksReturn;

    return result.items?.length > 0;
};

export function clientFetchPlaybook(playbookID: string) {
    return doGet<PlaybookWithChecklist>(`${apiUrl}/playbooks/${playbookID}`);
}

export async function savePlaybook(playbook: PlaybookWithChecklist | DraftPlaybookWithChecklist) {
    if (!playbook.id) {
        const data = await doPost(`${apiUrl}/playbooks`, JSON.stringify(playbook));
        return data;
    }

    await doFetchWithoutResponse(`${apiUrl}/playbooks/${playbook.id}`, {
        method: 'PUT',
        body: JSON.stringify(playbook),
    });
    return {id: playbook.id};
}

export async function archivePlaybook(playbookId: Playbook['id']) {
    const {data} = await doFetchWithTextResponse(`${apiUrl}/playbooks/${playbookId}`, {
        method: 'DELETE',
    });
    return data;
}

export async function restorePlaybook(playbookId: Playbook['id']) {
    const {data} = await doFetchWithTextResponse(`${apiUrl}/playbooks/${playbookId}/restore`, {
        method: 'PUT',
    });
    return data;
}

export async function importFile(file: any, teamId: string) {
    const data = await doPost(`${apiUrl}/playbooks/import?team_id=${teamId}`, file);
    return data;
}

export async function duplicatePlaybook(playbookId: Playbook['id']) {
    const {id} = await doPost(`${apiUrl}/playbooks/${playbookId}/duplicate`, '');
    return id;
}

export async function fetchOwnersInTeam(teamId: string): Promise<OwnerInfo[]> {
    const queryParams = qs.stringify({team_id: teamId}, {addQueryPrefix: true});

    let data = await doGet(`${apiUrl}/runs/owners${queryParams}`);
    if (!data) {
        data = [];
    }
    return data as OwnerInfo[];
}

export async function finishRun(playbookRunId: string) {
    try {
        return await doPut(`${apiUrl}/runs/${playbookRunId}/finish`);
    } catch (error) {
        return {error};
    }
}

export async function restoreRun(playbookRunId: string) {
    try {
        return await doPut(`${apiUrl}/runs/${playbookRunId}/restore`);
    } catch (error) {
        return {error};
    }
}

export async function toggleRunStatusUpdates(playbookRunId: string, status_enabled: boolean) {
    try {
        return await doPut(`${apiUrl}/runs/${playbookRunId}/status-update-enabled`, JSON.stringify({status_enabled}));
    } catch (error) {
        return {error};
    }
}

export async function setOwner(playbookRunId: string, ownerId: string) {
    const body = `{"owner_id": "${ownerId}"}`;
    try {
        const data = await doPost(`${apiUrl}/runs/${playbookRunId}/owner`, body);
        return data;
    } catch (error) {
        return {error};
    }
}

export async function setAssignee(playbookRunId: string, checklistNum: number, itemNum: number, assigneeId?: string) {
    const body = JSON.stringify({assignee_id: assigneeId});
    try {
        return await doPut(`${apiUrl}/runs/${playbookRunId}/checklists/${checklistNum}/item/${itemNum}/assignee`, body);
    } catch (error) {
        return {error};
    }
}

export async function setDueDate(playbookRunId: string, checklistNum: number, itemNum: number, date?: number) {
    const body = JSON.stringify({due_date: date});
    try {
        return await doPut(`${apiUrl}/runs/${playbookRunId}/checklists/${checklistNum}/item/${itemNum}/duedate`, body);
    } catch (error) {
        return {error};
    }
}

export async function setChecklistItemState(playbookRunID: string, checklistNum: number, itemNum: number, newState: ChecklistItemState) {
    const body = JSON.stringify({new_state: newState});
    try {
        return await doPut<void>(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/item/${itemNum}/state`, body);
    } catch (error) {
        return {error: error as ClientError};
    }
}

export async function clientDuplicateChecklistItem(playbookRunID: string, checklistNum: number, itemNum: number) {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/item/${itemNum}/duplicate`, {
        method: 'post',
        body: '',
    });
}

export async function clientSkipChecklistItem(playbookRunID: string, checklistNum: number, itemNum: number) {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/item/${itemNum}/skip`, {
        method: 'put',
        body: '',
    });
}

export async function clientSkipChecklist(playbookRunID: string, checklistNum: number) {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/skip`, {
        method: 'PUT',
        body: '',
    });
}

export async function clientRestoreChecklist(playbookRunID: string, checklistNum: number) {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/restore`, {
        method: 'PUT',
        body: '',
    });
}

export async function clientRestoreChecklistItem(playbookRunID: string, checklistNum: number, itemNum: number) {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/item/${itemNum}/restore`, {
        method: 'put',
        body: '',
    });
}

interface ChecklistItemUpdate {
    title?: string
    command: string
    description?: string
}

export async function clientEditChecklistItem(playbookRunID: string, checklistNum: number, itemNum: number, itemUpdate: ChecklistItemUpdate) {
    const data = await doPut(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/item/${itemNum}`,
        JSON.stringify({
            title: itemUpdate.title,
            command: itemUpdate.command,
            description: itemUpdate.description,
        }));

    return data;
}

export async function clientAddChecklistItem(playbookRunID: string, checklistNum: number, item: ChecklistItem) {
    const data = await doPost(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/add`,
        JSON.stringify(item)
    );

    return data;
}

export async function clientSetChecklistItemCommand(playbookRunID: string, checklistNum: number, itemNum: number, command: string) {
    const data = await doPut(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/item/${itemNum}/command`,
        JSON.stringify({
            command,
        }));

    return data;
}

export async function clientAddChecklist(playbookRunID: string, checklist: Checklist) {
    const data = await doPost(`${apiUrl}/runs/${playbookRunID}/checklists`,
        JSON.stringify(checklist),
    );

    return data;
}

export async function clientDuplicateChecklist(playbookRunID: string, checklistNum: number): Promise<void> {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/duplicate`, {
        method: 'post',
        body: '',
    });
}

export async function clientRenameChecklist(playbookRunID: string, checklistNum: number, newTitle: string) {
    const data = await doPut(`${apiUrl}/runs/${playbookRunID}/checklists/${checklistNum}/rename`,
        JSON.stringify({
            title: newTitle,
        }),
    );

    return data;
}

export async function clientMoveChecklist(playbookRunID: string, sourceChecklistIdx: number, destChecklistIdx: number) {
    const data = await doPost(`${apiUrl}/runs/${playbookRunID}/checklists/move`,
        JSON.stringify({
            source_checklist_idx: sourceChecklistIdx,
            dest_checklist_idx: destChecklistIdx,
        }),
    );

    return data;
}

export async function clientMoveChecklistItem(playbookRunID: string, sourceChecklistIdx: number, sourceItemIdx: number, destChecklistIdx: number, destItemIdx: number) {
    const data = await doPost(`${apiUrl}/runs/${playbookRunID}/checklists/move-item`,
        JSON.stringify({
            source_checklist_idx: sourceChecklistIdx,
            source_item_idx: sourceItemIdx,
            dest_checklist_idx: destChecklistIdx,
            dest_item_idx: destItemIdx,
        }),
    );

    return data;
}

export async function clientRemoveTimelineEvent(playbookRunID: string, entryID: string) {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/timeline/${entryID}`, {
        method: 'delete',
        body: '',
    });
}

// fetchSiteStats collect the stats we want to expose in system console
export async function fetchSiteStats(): Promise<SiteStats | null> {
    const data = await doGet(`${apiUrl}/stats/site`);
    if (!data) {
        return null;
    }
    return data as SiteStats;
}

export async function fetchPlaybookStats(playbookID: string): Promise<PlaybookStats> {
    const data = await doGet(`${apiUrl}/stats/playbook?playbook_id=${playbookID}`);
    if (!data) {
        return EmptyPlaybookStats;
    }

    return data as PlaybookStats;
}

// telemetryRunAction are the event types that can be reported to telemetry server re: PlaybookRun
// string is kept to do progressive migration to enum
type telemetryRunAction = PlaybookRunViewTarget | PlaybookRunEventTarget | string;

export async function telemetryEventForPlaybookRun(playbookRunID: string, action: telemetryRunAction) {
    await doFetchWithoutResponse(`${apiUrl}/telemetry/run/${playbookRunID}`, {
        method: 'POST',
        body: JSON.stringify({action}),
    });
}

export async function telemetryEventForPlaybook(playbookID: string, action: string) {
    await doFetchWithoutResponse(`${apiUrl}/telemetry/playbook/${playbookID}`, {
        method: 'POST',
        body: JSON.stringify({action}),
    });
}

export async function telemetryEventForTemplate(templateName: string, action: string) {
    await doFetchWithoutResponse(`${apiUrl}/telemetry/template`, {
        method: 'POST',
        body: JSON.stringify({template_name: templateName, action}),
    });
}

export async function telemetryEvent(name: TelemetryEventTarget, properties: {[key: string]: string}) {
    await doFetchWithoutResponse(`${apiUrl}/telemetry`, {
        method: 'POST',
        body: JSON.stringify(
            {name, type: 'track', properties}
        ),
    });
}

export async function telemetryView(name: TelemetryViewTarget, properties: {[key: string]: string}) {
    await doFetchWithoutResponse(`${apiUrl}/telemetry`, {
        method: 'POST',
        body: JSON.stringify(
            {name, type: 'page', properties}
        ),
    });
}

export async function fetchGlobalSettings(): Promise<GlobalSettings> {
    const data = await doGet(`${apiUrl}/settings`);
    if (!data) {
        return globalSettingsSetDefaults({});
    }

    return globalSettingsSetDefaults(data);
}

export async function updateRetrospective(playbookRunID: string, updatedText: string, metrics: RunMetricData[]) {
    const data = await doPost(`${apiUrl}/runs/${playbookRunID}/retrospective`,
        JSON.stringify({
            retrospective: updatedText,
            metrics,
        }));
    return data;
}

export async function publishRetrospective(playbookRunID: string, currentText: string, metrics: RunMetricData[]) {
    const data = await doPost(`${apiUrl}/runs/${playbookRunID}/retrospective/publish`,
        JSON.stringify({
            retrospective: currentText,
            metrics,
        }));
    return data;
}

export async function noRetrospective(playbookRunID: string) {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunID}/no-retrospective-button`, {
        method: 'POST',
    });
}

export function exportChannelUrl(channelId: string) {
    const exportPluginUrl = '/plugins/com.mattermost.plugin-channel-export/api/v1';

    const queryParams = qs.stringify({
        channel_id: channelId,
        format: 'csv',
    }, {addQueryPrefix: true});

    return `${exportPluginUrl}/export${queryParams}`;
}

export const postMessageToAdmins = async (messageType: AdminNotificationType) => {
    const body = `{"message_type": "${messageType}"}`;
    try {
        const response = await doPost(`${apiUrl}/bot/notify-admins`, body);
        return {data: response};
    } catch (e) {
        return {error: e.message};
    }
};

export const notifyConnect = async () => {
    await doFetchWithoutResponse(`${apiUrl}/bot/connect`, {
        method: 'GET',
        headers: {
            'X-Timezone-Offset': -new Date().getTimezoneOffset() / 60,
        },
    });
};

export const followPlaybookRun = async (playbookRunId: string) => {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunId}/followers`, {
        method: 'PUT',
    });
};

export const unfollowPlaybookRun = async (playbookRunId: string) => {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunId}/followers`, {
        method: 'DELETE',
    });
};

export const autoFollowPlaybook = async (playbookId: string, userId: string) => {
    await doFetchWithoutResponse(`${apiUrl}/playbooks/${playbookId}/autofollows/${userId}`, {
        method: 'PUT',
    });
};

export const autoUnfollowPlaybook = async (playbookId: string, userId: string) => {
    await doFetchWithoutResponse(`${apiUrl}/playbooks/${playbookId}/autofollows/${userId}`, {
        method: 'DELETE',
    });
};

export async function clientFetchPlaybookFollowers(playbookId: string): Promise<string[]> {
    const data = await doGet<string[]>(`${apiUrl}/playbooks/${playbookId}/autofollows`);

    if (!data) {
        return [];
    }

    return data;
}

export const resetReminder = async (playbookRunId: string, newReminderSeconds: number) => {
    await doFetchWithoutResponse(`${apiUrl}/runs/${playbookRunId}/reminder`, {
        method: 'POST',
        body: JSON.stringify({
            new_reminder_seconds: newReminderSeconds,
        }),
    });
};

export const fetchChannelActions = async (channelID: string, triggerType?: string): Promise<ChannelAction[]> => {
    const queryParams = triggerType ? `?trigger_type=${triggerType}` : '';
    const data = await doGet(`${apiUrl}/actions/channels/${channelID}${queryParams}`);
    if (!data) {
        return [];
    }

    return data;
};

export const saveChannelAction = async (action: ChannelAction): Promise<string> => {
    if (!action.id) {
        const data = await doPost(`${apiUrl}/actions/channels/${action.channel_id}`, JSON.stringify(action));
        return data.id;
    }

    await doFetchWithoutResponse(`${apiUrl}/actions/channels/${action.channel_id}/${action.id}`, {
        method: 'PUT',
        body: JSON.stringify(action),
    });
    return action.id;
};

export const requestUpdate = async (playbookRunId: string) => {
    try {
        return await doPost(`${apiUrl}/runs/${playbookRunId}/request-update`);
    } catch (error) {
        return {error};
    }
};

export const requestJoinChannel = async (playbookRunId: string) => {
    try {
        return await doPost(`${apiUrl}/runs/${playbookRunId}/request-join-channel`);
    } catch (error) {
        return {error};
    }
};

export const isFavoriteItem = async (teamID: string, itemID: string, itemType: string) => {
    const data = await doGet<void>(`${apiUrl}/my_categories/favorites?team_id=${teamID}&item_id=${itemID}&type=${itemType}`);
    return Boolean(data);
};

export const fetchMyCategories = async (teamID: string): Promise<Category[]> => {
    const queryParams = `?team_id=${teamID}`;
    const data = await doGet(`${apiUrl}/my_categories${queryParams}`);
    if (!data) {
        return [];
    }

    return data;
};

export const setCategoryCollapsed = async (categoryID: string, collapsed: boolean) => {
    try {
        return await doPut(`${apiUrl}/my_categories/${categoryID}/collapse`, collapsed);
    } catch (error) {
        return {error};
    }
};

export const doGet = async <TData = any>(url: string) => {
    const {data} = await doFetchWithResponse<TData>(url, {method: 'get'});

    return data;
};

export const doPost = async <TData = any>(url: string, body = {}) => {
    const {data} = await doFetchWithResponse<TData>(url, {
        method: 'POST',
        body,
    });

    return data;
};

export const doPut = async <TData = any>(url: string, body = {}) => {
    const {data} = await doFetchWithResponse<TData>(url, {
        method: 'PUT',
        body,
    });

    return data;
};

export const doFetchWithResponse = async <TData = any>(url: string, options = {}) => {
    const response = await fetch(url, Client4.getOptions(options));
    let data;
    if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType === 'application/json') {
            data = await response.json() as TData;
        }

        return {
            response,
            data,
        };
    }

    data = await response.text();

    throw new ClientError(Client4.url, {
        message: data || '',
        status_code: response.status,
        url,
    });
};

export const doFetchWithTextResponse = async <TData extends string>(url: string, options = {}) => {
    const response = await fetch(url, Client4.getOptions(options));

    let data;
    if (response.ok) {
        data = await response.text() as TData;

        return {
            response,
            data,
        };
    }

    data = await response.text();

    throw new ClientError(Client4.url, {
        message: data || '',
        status_code: response.status,
        url,
    });
};

export const doFetchWithoutResponse = async (url: string, options = {}) => {
    const response = await fetch(url, Client4.getOptions(options));

    if (response.ok) {
        return;
    }

    throw new ClientError(Client4.url, {
        message: '',
        status_code: response.status,
        url,
    });
};

export const playbookExportProps = (playbook: {id: string, title: string}) => {
    const href = `${apiUrl}/playbooks/${playbook.id}/export`;
    const filename = playbook.title.split(/\s+/).join('_').toLowerCase() + '_playbook.json';
    return [href, filename];
};

export async function getMyTopPlaybooks(timeRange: string, page: number, perPage: number, teamId: string): Promise<InsightsResponse | null> {
    const queryParams = qs.stringify({
        time_range: timeRange,
        page,
        per_page: perPage,
        team_id: teamId,
    }, {addQueryPrefix: true});

    const data = await doGet(`${apiUrl}/playbooks/insights/user/me${queryParams}`);
    if (!data) {
        return null;
    }
    return data as InsightsResponse;
}

export async function getTeamTopPlaybooks(timeRange: string, page: number, perPage: number, teamId: string): Promise<InsightsResponse | null> {
    const queryParams = qs.stringify({
        time_range: timeRange,
        page,
        per_page: perPage,
    }, {addQueryPrefix: true});

    const data = await doGet(`${apiUrl}/playbooks/insights/teams/${teamId}${queryParams}`);
    if (!data) {
        return null;
    }
    return data as InsightsResponse;
}
