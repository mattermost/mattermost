import { Post } from "@mattermost/types/posts";
import { FetchPaginatedThreadOptions } from "@mattermost/types/client4";
import { MessageStore } from "e2ee/storage/MessageStore";

let messageStoreByUser: Map<string, MessageStore> = new Map();

function getMessageStore(userId: string): MessageStore {
    let store = messageStoreByUser.get(userId);
    if (!store) {
        store = new MessageStore(userId);
        messageStoreByUser.set(userId, store);
    }
    return store;
}

export async function savePost(userId: string, post: Post) {
    const messageStore = getMessageStore(userId);
    await messageStore.savePost(post);
}

export async function getPostById(userId: string, postId: string) {
    const messageStore = getMessageStore(userId);
    return await messageStore.getPostById(postId);
}

export async function getPosts(userId: string, channelId: string) {
    const messageStore = getMessageStore(userId);
    return await messageStore.getPosts(channelId);
}

export async function getPostsBefore(userId: string, channelId: string, postId: string) {
    const messageStore = getMessageStore(userId);
    return await messageStore.getPostsBefore(channelId, postId);
}

export async function getPostsAfter(userId: string, channelId: string, postId: string) {
    const messageStore = getMessageStore(userId);
    return await messageStore.getPostsAfter(channelId, postId);
}
export async function getPostsSince(userId: string, channelId: string, since: number) {
    const messageStore = getMessageStore(userId);
    return await messageStore.getPostSince(channelId, since);
}
export async function getPaginatedPostThread(userId: string, rootId: string, options: FetchPaginatedThreadOptions) {
    const messageStore = getMessageStore(userId);
    return await messageStore.getPaginatedPostThread(rootId, options);
}

export async function getPostsAround(userId: string, channelId: string, postId: string) {
    const messageStore = getMessageStore(userId);
    return await messageStore.getPostsAround(channelId, postId);
}