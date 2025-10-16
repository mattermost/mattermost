import MiniSearch, { CombinationOperator } from "minisearch";
import { MessageDB } from "./MessageStore";
import { Post, PostSearchResults } from "@mattermost/types/posts";
import { SearchParameter } from "@mattermost/types/search";
import Dexie from "dexie";


type ParsedQuery = {
    from?: string;
    in?: string;
    on?: string;
    before?: string;
    after?: string;
    text?: string;
}

type PostDoc = {
    id: string;
    message: string;
}

export class LocalSearchEngine {
    private db: MessageDB;
    private mini: MiniSearch<PostDoc>;
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
        this.db = new MessageDB(userId);
        this.mini = new MiniSearch<PostDoc>({
            fields: [ 'message'],
            storeFields: ['id'],
            idField: 'id'
        });
    }

    async build() {
        const rows = await this.db.search_index.get(this.userId);
        if (rows?.json) {
            this.mini = MiniSearch.loadJSON(JSON.stringify(rows.json), {
                fields: ['message'],
                storeFields: ['id'],
                idField: 'id'
            });
        } else {
            const postDoc: PostDoc[] = [];
            await this.db.posts.toCollection().each((p) => {
                if (p.type === '') {
                    postDoc.push({id: p.id, message: p.message});
                }
            });
            await this.mini.addAllAsync(postDoc);
        } 
        await this.persistSnapshot();
    }

    async searchWithParams(params: SearchParameter): Promise<PostSearchResults> {
        const page = params.page;
        const per_page = params.per_page;
        const combine: CombinationOperator = params.is_or_search ? 'OR' : 'AND';

        const q = parseQuery(params.terms);
        let ids: string[] = [];
        if (q.text) {
            const hits = this.mini.search(q.text, {
                combineWith: combine,
                prefix: true,
            });
            ids = hits.map(h => h.id);
        }
        const rows = await this.db.posts.where('id').anyOf(ids).toArray();
        rows.sort((a, b) => b.create_at - a.create_at);
        const slice = rows.slice(page * per_page, page * per_page + per_page);

        const posts: Record<string, Post> = Object.fromEntries(slice.map(p => [p.id, p]));
        const order = slice.map(p => p.id);

        return {
            posts,
            order,
            next_post_id:'',
            prev_post_id: '',
            first_inaccessible_post_time: 0,
            matches: {}
        };
    }

    async persistSnapshot() {
        const json = this.mini.toJSON();
        await this.db.search_index.put({
            key: this.userId,
            json,
            update_at: Date.now()
        });
    }

    async add(posts: Post | Post[]) {
        const upsert = (p: Post) => {
            const doc = {id: p.id, message: p.message};
            if (this.mini.has(p.id)) {
                return;
            } else {
                this.mini.add(doc);
            }
        };

        if (Array.isArray(posts)) {
            const news = posts.filter(p => !this.mini.has(p.id)).map(p => ({id: p.id, message: p.message}));
            if  (news.length) await this.mini.addAllAsync(news);
        } else {
            upsert(posts);
        }
        await this.persistSnapshot();
    }

    private buildMatches(queryText: string, posts: Array<{id: string, message: string}>): Record<string, string[]> {
        return {};
    }

    // private async filterCandidatesDexie(q: ParsedQuery, params: SearchParameter): Promise<Post[]> {
    //     const tz = params.time_zone_offset ?? 0;
    //     const range = computeTimeRange(q, tz);

    //     let channelId: string | undefined;
    //     if (q.in) {
    //         const raw = q.in.startsWith('~') ? q.in.slice(1): q.in;
    //         channelId = 
    //     }
    // }
}

export function parseQuery(terms: string): ParsedQuery {
    const t = (terms || '').trim();
    const pick = (re: RegExp) => (t.match(re)?.[1] || '').trim();
    const from   = pick(/(?:^|\s)From:([^\s]+)/i);
    const inChan = pick(/(?:^|\s)In:([^\s]+)/i);
    const on     = pick(/(?:^|\s)On:(\d{4}-\d{2}-\d{2})/i);
    const before = pick(/(?:^|\s)Before:(\d{4}-\d{2}-\d{2})/i);
    const after  = pick(/(?:^|\s)After:(\d{4}-\d{2}-\d{2})/i);

    const text = t.replace(/(?:^|\s)(From|In|On|Before|After):[^\s]+/gi, ' ').trim();
    return {
        from,
        in: inChan,
        on,
        before,
        after,
        text
    };
}

export function computeTimeRange(q: ParsedQuery, tzOffsetMinutes: number): {low: number; high: number; incLow: boolean; incHigh: boolean} | undefined {
    const ymdToUTC = (ymd: string) => {
        const [y, m, d] = ymd.split('-').map(Number);
        const startUTC = Date.UTC(y, m - 1, d) - tzOffsetMinutes * 60_000;
        const endUTC = startUTC + 24 * 60 * 60 * 1000 - 1;
        return [startUTC, endUTC] as const;
    }

    if (q.on) {
        const [lo, hi] = ymdToUTC(q.on);
        return {low: lo, high: hi, incLow: true, incHigh: true};
    }

    if (q.before && q.after) {
        const [aLo] = ymdToUTC(q.after);
        const [, bHi] = ymdToUTC(q.before);
        return {low: aLo, high: bHi, incLow: false, incHigh: false};
    }

    if (q.before) {
        const [lo] = ymdToUTC(q.before);
        return {low: Number.MIN_SAFE_INTEGER, high: lo, incLow: true, incHigh: false};
    }
    
    if (q.after) {
        const [, hi] = ymdToUTC(q.after);
        return {low: hi, high: Number.MAX_SAFE_INTEGER, incLow: false, incHigh: true};
    }

    return undefined;
}