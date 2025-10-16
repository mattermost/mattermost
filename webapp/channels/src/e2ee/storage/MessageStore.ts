import { Post, PostList, PostSearchResults } from "@mattermost/types/posts";
import { SearchParameter } from "@mattermost/types/search";
import { FetchPaginatedThreadOptions } from "@mattermost/types/client4";
import Dexie, {Table} from "dexie";
import { addToIndex } from "e2ee/service/SearchService";
import { Posts } from "mattermost-redux/constants";
import MiniSearch, { CombinationOperator } from "minisearch";

export class MessageDB extends Dexie {
    posts!: Table<Post, string>;
    search_index!: Table<{key: string; json: any; update_at: number}, string>;

    constructor(userId: string) {
        super(`model::${userId}`);
        this.version(3).stores({
            posts: 'id, channel_id, [channel_id+create_at], [root_id+create_at+id], [root_id+update_at+id], create_at, update_at, root_id',
            search_index: 'key',
        });
    }
}

export class MessageStore {
    private db: MessageDB;
    private userId: string;
    constructor(userId: string) {
        this.userId = userId;
        this.db = new MessageDB(userId);
    }

    async savePost(posts: Post | Post[]): Promise<void> {
        if (Array.isArray(posts)) {
            if (posts.length === 0) return;
            await this.db.posts.bulkPut(posts);
        } else {
            await this.db.posts.put(posts);
        }
        const a = this.userId;
        await addToIndex(this.userId, posts);
    }

    async saveFromPostList(postList: PostList): Promise<void> {
        const arr = postList.order.map((id) => postList.posts[id]).filter(Boolean);
        if (arr.length) await this.db.posts.bulkPut(arr);
    }

    async getPostById(id: string): Promise<Post | undefined> {
        return this.db.posts.get(id);
    }

    async getPosts(channelId: string, page = 0, perPage = 60): Promise<PostList> {
        const offset = page * perPage;

        const coll = this.db.posts
            .where('[channel_id+create_at]')
            .between([channelId, Dexie.minKey], [channelId, Dexie.maxKey])
            .and((p) => p.root_id === '');
            
        const rows = await coll
            .reverse()
            .offset(offset)
            .limit(perPage + 1)
            .toArray();
        
        const hasMoreOlder = rows.length > perPage;
        const slice = hasMoreOlder ? rows.slice(0, perPage): rows;

        const order = slice.map(p => p.id);
        const posts: Record<string, Post> = Object.fromEntries(slice.map(p => [p.id, p]));

        const prev_post_id = hasMoreOlder ? rows[rows.length - 1].id: "";
        const next_post_id = '';

        return {
            order,
            posts,
            next_post_id,
            prev_post_id,
            first_inaccessible_post_time: 0
        };
    }

    async getPostsBefore(channelId: string, postId: string, page = 0, perPage = Posts.POST_CHUNK_SIZE / 2): Promise<PostList> {
        const anchor = await this.getPostById(postId);
        if (!anchor) {
            return this.getPosts(channelId, 0, perPage);
        }
        const anchorTS = anchor.create_at;
        const offset = page * perPage;

        const coll = await this.db.posts
            .where('[channel_id+create_at]')
            .between([channelId, Dexie.minKey], [channelId, anchorTS], true, false)
            .and((p) => p.root_id === '');

        const rows = await coll
            .reverse()
            .offset(offset)
            .limit(perPage + 1)
            .toArray();
        
        const hasMoreOlder = rows.length > perPage;
        const slice = hasMoreOlder ? rows.slice(0, perPage): rows;

        const order = slice.map(p => p.id);
        const posts: Record<string, Post> = Object.fromEntries(slice.map(p => [p.id, p]));

        const prev_post_id = hasMoreOlder ? rows[rows.length - 1].id: '';
        const next_post_id = postId;

        return {
            order,
            posts,
            next_post_id,
            prev_post_id,
            first_inaccessible_post_time: 0
        }
    }

    async getPostsAfter(channelId: string, postId: string, page = 0, perPage = Posts.POST_CHUNK_SIZE / 2): Promise<PostList> {
        const anchor = await this.getPostById(postId);
        if (!anchor) {
            return this.getPosts(channelId, 0, perPage);
        }
        const anchorTS = anchor.create_at;
        const offset = page * perPage;

        const coll = await this.db.posts
            .where('[channel_id+create_at]')
            .between([channelId, anchorTS], [channelId, Dexie.maxKey], false, true)
            .and((p) => p.root_id === '')
        
        const rows = await coll
            .offset(offset)
            .limit(perPage + 1)
            .toArray();
        
        const hasMoreNewer = rows.length > perPage;
        const slice = hasMoreNewer ? rows.slice(0, perPage) : rows;
        
        const order = slice.toReversed().map(p => p.id);
        const posts: Record<string, Post> = Object.fromEntries(slice.map(p => [p.id, p]));

        const next_post_id = hasMoreNewer ? rows[rows.length - 1].id : '';
        const prev_post_id = postId;

        return {
            order, 
            posts,
            next_post_id,
            prev_post_id,
            first_inaccessible_post_time: 0
        }
    }

    async getPostSince(channelId: string, since: number): Promise<PostList> {
        const rows = await this.db.posts
            .where('[channel_id+create_at]')
            .between([channelId, since], [channelId,Dexie.maxKey], true, true)
            .and((p) => p.root_id === '')
            .reverse()
            .toArray()

        const order = rows.map(p => p.id);
        const posts: Record<string, Post> = Object.fromEntries(rows.map(p => [p.id, p]));

        // Với "since" phía server thường không cần prev/next cursor
        const next_post_id = '';
        const prev_post_id = '';

        return {
            order,
            posts,
            next_post_id,
            prev_post_id,
            first_inaccessible_post_time: 0,
        };
    }

    async getPaginatedPostThread(rootId: string, options: FetchPaginatedThreadOptions, prevList?: PostList): Promise<PostList & {has_next: boolean}> {
        const perPage = options.perPage ?? 1000;
        const direction = options.direction ?? 'down';
        const updates = !!options.updatesOnly;

        const root = await this.getPostById(rootId);
        const list: PostList = {
            order: [rootId],
            posts: root? {[rootId]: root} : {},
            prev_post_id: '',
            next_post_id: '',
            first_inaccessible_post_time: 0
        };

        const indexName = updates ? '[root_id+update_at+id]': '[root_id+create_at+id]';

        const fromT = updates ? (options.fromUpdateAt ?? Dexie.minKey) : (options.fromCreateAt ?? Dexie.minKey);
        
        const fromP = options.fromPost ?? Dexie.minKey;

        let coll: Dexie.Collection<Post, string>;
        if (direction === 'down') {
            coll = this.db.posts
                .where(indexName)
                .between([rootId, fromT, fromP], [rootId, Dexie.maxKey, Dexie.maxKey], false, true)

        } else {
            const hiT = updates ? (options.fromUpdateAt ?? Dexie.maxKey): (options.fromCreateAt ?? Dexie.maxKey)
            const hiP = options.fromPost ?? Dexie.maxKey;
            coll = this.db.posts
                .where(indexName)
                .between([rootId, Dexie.minKey, Dexie.minKey], [rootId, hiT, hiP], true, false);
        }

        const rows = await coll.limit(perPage + 1).toArray();
        const has_next = rows.length > perPage;
        const pageRows = has_next ? rows.slice(0, perPage): rows;

        const repliesDesc = direction === 'down' ? pageRows : pageRows.slice().reverse();

        for (const p of repliesDesc) {
            list.posts[p.id] = p;
        }
        list.order.push(...repliesDesc.map(p => p.id));

        list.next_post_id = has_next ? rows[rows.length - 1].id : '';

        return Object.assign(list, {has_next});
    }

    async getPostThread(postId: string, perPage = 60): Promise<PostList & {has_next: boolean}> {
        const root = await this.getPostById(postId);
        if (!root) {
            return {
                order: [],
                posts: {},
                prev_post_id: '',
                next_post_id: '',
                first_inaccessible_post_time: 0,
                has_next: false
            };
        }
        const rootId = root.id;
        const rows = await this.db.posts
            .where('[root_id+create_at+id]')
            .between([rootId, Dexie.minKey, Dexie.minKey], [rootId, Dexie.maxKey, Dexie.maxKey])
            .limit(perPage + 1)
            .toArray()

        const has_next = rows.length > perPage;

        const posts: Record<string, Post> = {[rootId]: root};
        for (const p of rows) posts[p.id] = p;

        const order = [rootId, ...rows.map(p => p.id)];

        return {
            posts,
            order,
            prev_post_id:'',
            next_post_id:'',
            first_inaccessible_post_time: 0,
            has_next
        }
    }

    async getPostsAround(channelId: string, postId: string): Promise<PostList> {
        const before = await this.getPostsBefore(channelId, postId);
        const thread = await this.getPostThread(postId);
        const after = await this.getPostsAfter(channelId, postId);

        const posts: PostList = {
            posts: {
                ...after.posts,
                ...thread.posts,
                ...before.posts,
            },
            order: [
                ...after.order,
                postId,
                ...before.order,
            ],
            next_post_id: after.next_post_id,
            prev_post_id: before.prev_post_id,
            first_inaccessible_post_time: 0
        }
        return posts;
    }
}
