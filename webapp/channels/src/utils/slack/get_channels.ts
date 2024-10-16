import axios from 'axios';

interface Topic {
    value: string;
    creator: string;
    last_set: number;
}

interface Purpose {
    value: string;
    creator: string;
    last_set: number;
}

interface Properties {
    canvas?: {
        file_id: string;
        is_empty: boolean;
        quip_thread_id: string;
    };
}

export interface SlackChannel {
    id: string;
    created: number;
    is_open: boolean;
    is_group: boolean;
    is_shared: boolean;
    is_im: boolean;
    is_ext_shared: boolean;
    is_org_shared: boolean;
    is_global_shared: boolean;
    is_pending_ext_shared: boolean;
    is_private: boolean;
    is_read_only: boolean;
    is_mpim: boolean;
    unlinked: number;
    name_normalized: string;
    num_members: number;
    priority: number;
    user: string;
    shared_team_ids: string[];
    name: string;
    creator: string;
    is_archived: boolean;
    members: any;
    topic: Topic;
    purpose: Purpose;
    is_channel: boolean;
    is_general: boolean;
    is_member: boolean;
    locale: string;
    properties?: Properties;
}

export const getSlackChannels = async (url: string): Promise<SlackChannel[]> => {
    const mmauthToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('MMAUTHTOKEN='))
        ?.split('=')[1];
    const mmcsrf = document.cookie
        .split('; ')
        .find(row => row.startsWith('MMCSRF='))
        ?.split('=')[1];
    const mmuserId = document.cookie
        .split('; ')
        .find(row => row.startsWith('MMUSERID='))
        ?.split('=')[1];

    const headers = new Headers({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mmauthToken}`,
        'X-CSRF-Token': mmcsrf || '',
        'MMUSERID': mmuserId || '',
    });

    try {
        const response = await axios.get(url, { headers, withCredentials: true });
        return response.data;
    } catch (error) {
        console.error('Error fetching Slack channels:', error);
        throw error;
    }
};
