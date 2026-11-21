import type {Channel} from '../types/channels';
import type {UserProfile} from '../types/users';

// what doFetchWithResponse returns: the body is `data`
export type ClientResponse<T> = {response: Response; headers: Map<string, string>; data: T};

export class Client4 {
    url = '';
    urlVersion = '/api/v4';

    getBaseRoute() {
        return `${this.url}${this.urlVersion}`;
    }
    getChannelsRoute() {
        return `${this.getBaseRoute()}/channels`;
    }
    getChannelRoute(channelId: string) {
        return `${this.getChannelsRoute()}/${channelId}`;
    }
    getUsersRoute() {
        return `${this.getBaseRoute()}/users`;
    }
    doFetch<T>(url: string, opts: {method?: string; body?: string}): Promise<T> {
        return fetch(url, opts as RequestInit).then((r) => r.json());
    }

    doFetchWithResponse<T>(url: string, opts: {method?: string}): Promise<ClientResponse<T>> {
        return fetch(url, opts as RequestInit).then(async (r) => ({response: r, headers: new Map(), data: await r.json()}));
    }

    restoreChannel = (channelId: string) => {
        return this.doFetchWithResponse<Channel>(`${this.getChannelRoute(channelId)}/restore`, {method: 'post'});
    };
    patchChannel = (channelId: string, patch: Partial<Channel>) => {
        return this.doFetch<Channel>(`${this.getChannelRoute(channelId)}/patch`, {method: 'put', body: JSON.stringify(patch)});
    };
    getMe = () => {
        return this.doFetch<UserProfile>(`${this.getUsersRoute()}/me`, {method: 'get'});
    };
    requestJoinChannel = (channelId: string) => {
        return this.doFetch<{status: string}>(`${this.getChannelRoute(channelId)}/join_request`, {method: 'post'});
    };
    logClientError = (message: string) => {
        return this.doFetch<{status: string}>(`${this.getBaseRoute()}/logs`, {method: 'post', body: message});
    };
}

const client = new Client4();
export default client;
