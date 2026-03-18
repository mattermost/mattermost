// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef, useState} from 'react';

import type {Post} from '@mattermost/types/posts';

import {usePost} from 'components/common/hooks/usePost';

export function usePropertyCardViewPostLoader(postId: string, getPost?: (postId: string) => Promise<Post>, fetchDeletedPost?: boolean) {
    const loadedPost = useRef(false);
    const [post, setPost] = useState<Post>();

    const postFromStore = usePost(postId);

    useEffect(() => {
        if (post && post.id !== postId) {
            setPost(undefined);
            loadedPost.current = false;
        }
    }, [post, postId]);

    useEffect(() => {
        const usePostFromStore = Boolean(!getPost && postFromStore);
        const allowDeletedPost = postFromStore?.delete_at === 0 ? true : !fetchDeletedPost;
        if (usePostFromStore && allowDeletedPost) {
            setPost(postFromStore);
            loadedPost.current = true;
            return;
        }

        const loadPost = async () => {
            const canLoadPost = getPost && !loadedPost.current && !post;
            if (!canLoadPost) {
                return;
            }

            try {
                const fetchedPost = await getPost(postId);
                if (fetchedPost) {
                    setPost(fetchedPost);
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log('Error occurred while fetching post for post preview property renderer', error);
            } finally {
                loadedPost.current = true;
            }
        };

        loadPost();
    }, [getPost, post, postFromStore, postId, fetchDeletedPost]);

    return post;
}
