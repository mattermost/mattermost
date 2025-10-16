import { SearchParameter } from "@mattermost/types/search";
import { Post, PostList, PostSearchResults } from "@mattermost/types/posts";
import { LocalSearchEngine } from "e2ee/storage/LocalSearch";

let searchEngineByUser: Map<string, LocalSearchEngine> = new Map();

export async function getSearchEngine(userId: string) {
    let searchEngine = searchEngineByUser.get(userId);
    if (!searchEngine) {
        searchEngine = new LocalSearchEngine(userId);
        await searchEngine.build();
        searchEngineByUser.set(userId, searchEngine);
    }
    return searchEngine;
}

export async function addToIndex(userId: string, posts: Post | Post[]) {
    const search = await getSearchEngine(userId);
    await search.add(posts);
}

export async function searchPostsWithParams(userId: string, params: SearchParameter): Promise<PostSearchResults> {
    const search = await getSearchEngine(userId);
    const posts = await search.searchWithParams(params);
    return posts;
}