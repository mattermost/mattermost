// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';

import {GifTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import gfycatSdk from 'mattermost-redux/utils/gfycat_sdk';

// APP PROPS

export function saveAppPropsRequest(props: any) {
    return {
        type: GifTypes.SAVE_APP_PROPS,
        props,
    };
}

export function saveAppProps(appProps: any) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {GfycatAPIKey, GfycatAPISecret} = getState().entities.general.config;
        gfycatSdk(GfycatAPIKey!, GfycatAPISecret!).authenticate();
        dispatch(saveAppPropsRequest(appProps));
    };
}

// SEARCH

export function selectSearchText(searchText: string) {
    return {
        type: GifTypes.SELECT_SEARCH_TEXT,
        searchText,
    };
}

export function updateSearchText(searchText: string) {
    return {
        type: GifTypes.UPDATE_SEARCH_TEXT,
        searchText,
    };
}

export function searchBarTextSave(searchBarText: string) {
    return {
        type: GifTypes.SAVE_SEARCH_BAR_TEXT,
        searchBarText,
    };
}

export function invalidateSearchText(searchText: string) {
    return {
        type: GifTypes.INVALIDATE_SEARCH_TEXT,
        searchText,
    };
}

export function requestSearch(searchText: string) {
    return {
        type: GifTypes.REQUEST_SEARCH,
        searchText,
    };
}

export function receiveSearch({searchText, count, start, json}: {searchText: string; count: number; start: number; json: any}) {
    return {
        type: GifTypes.RECEIVE_SEARCH,
        searchText,
        ...json,
        count,
        start,
        currentPage: start / count,
        receivedAt: Date.now(),
    };
}

export function receiveSearchEnd(searchText: string) {
    return {
        type: GifTypes.RECEIVE_SEARCH_END,
        searchText,
    };
}

export function errorSearching(err: any, searchText: string) {
    return {
        type: GifTypes.SEARCH_FAILURE,
        searchText,
        err,
    };
}

export function receiveCategorySearch({tagName, json}: {tagName: string; json: any}) {
    return {
        type: GifTypes.RECEIVE_CATEGORY_SEARCH,
        searchText: tagName,
        ...json,
        receiveAt: Date.now(),
    };
}

export function clearSearchResults() {
    return {
        type: GifTypes.CLEAR_SEARCH_RESULTS,
    };
}

export function requestSearchById(gfyId: string) {
    return {
        type: GifTypes.SEARCH_BY_ID_REQUEST,
        payload: {
            gfyId,
        },
    };
}

export function receiveSearchById(gfyId: string, gfyItem: any) {
    return {
        type: GifTypes.SEARCH_BY_ID_SUCCESS,
        payload: {
            gfyId,
            gfyItem,
        },
    };
}

export function errorSearchById(err: any, gfyId: string) {
    return {
        type: GifTypes.SEARCH_BY_ID_FAILURE,
        err,
        gfyId,
    };
}

export function searchScrollPosition(scrollPosition: number) {
    return {
        type: GifTypes.SAVE_SEARCH_SCROLL_POSITION,
        scrollPosition,
    };
}

export function searchPriorLocation(priorLocation: number) {
    return {
        type: GifTypes.SAVE_SEARCH_PRIOR_LOCATION,
        priorLocation,
    };
}

export function searchGfycat({searchText, count = 30, startIndex = 0}: { searchText: string; count?: number; startIndex?: number}) {
    let start = startIndex;
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {GfycatAPIKey, GfycatAPISecret} = getState().entities.general.config;
        const {resultsByTerm} = getState().entities.gifs.search;
        if (resultsByTerm[searchText]) {
            start = resultsByTerm[searchText].start + count;
        }
        dispatch(requestSearch(searchText));
        const sdk = gfycatSdk(GfycatAPIKey!, GfycatAPISecret!);
        sdk.authenticate();
        return sdk.search({search_text: searchText, count, start}).then((json: any) => {
            if (json.errorMessage) {
                // There was no results before
                if (resultsByTerm[searchText].items) {
                    dispatch(receiveSearchEnd(searchText));
                } else {
                    dispatch(errorSearching(json, searchText));
                }
            } else {
                dispatch(updateSearchText(searchText));
                dispatch(cacheGifsRequest(json.gfycats));
                dispatch(receiveSearch({searchText, count, start, json}));

                const context = getState().entities.gifs.categories.tagsDict[searchText] ?
                    'category' :
                    'search';
                Client4.trackEvent(
                    'gfycat',
                    'views',
                    {context, count: json.gfycats.length, keyword: searchText},
                );
            }
        }).catch(
            (err: any) => dispatch(errorSearching(err, searchText)),
        );
    };
}

export function searchCategory({tagName = '', gfyCount = 30, cursorPos = undefined}) {
    let cursor: string | undefined = cursorPos;
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {GfycatAPIKey, GfycatAPISecret} = getState().entities.general.config;
        const {resultsByTerm} = getState().entities.gifs.search;
        if (resultsByTerm[tagName]) {
            cursor = resultsByTerm[tagName].cursor;
        }
        dispatch(requestSearch(tagName));
        return gfycatSdk(GfycatAPIKey!, GfycatAPISecret!).getTrendingCategories({tagName, gfyCount, cursor}).then(
            (json: any) => {
                if (json.errorMessage) {
                    if (resultsByTerm[tagName].gfycats) {
                        dispatch(receiveSearchEnd(tagName));
                    } else {
                        dispatch(errorSearching(json, tagName));
                    }
                } else {
                    dispatch(updateSearchText(tagName));
                    dispatch(cacheGifsRequest(json.gfycats));
                    dispatch(receiveCategorySearch({tagName, json}));

                    Client4.trackEvent(
                        'gfycat',
                        'views',
                        {context: 'category', count: json.gfycats.length, keyword: tagName},
                    );

                    // preload categories list
                    if (tagName === 'trending') {
                        dispatch(requestCategoriesListIfNeeded() as any);
                    }
                }
            },
        ).catch((err: any) => dispatch(errorSearching(err, tagName)));
    };
}

export function shouldSearch(state: GlobalState, searchText: string) {
    const resultsByTerm = state.entities.gifs.search.resultsByTerm[searchText];
    if (!resultsByTerm) {
        return true;
    } else if (resultsByTerm.isFetching) {
        return false;
    } else if (resultsByTerm.moreRemaining) {
        return true;
    }
    return resultsByTerm.didInvalidate;
}

export function searchIfNeeded(searchText: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        if (shouldSearch(getState(), searchText)) {
            if (searchText.toLowerCase() === 'trending') {
                return dispatch(searchCategory({tagName: searchText}));
            }
            return dispatch(searchGfycat({searchText}));
        }
        return Promise.resolve();
    };
}

export function searchIfNeededInitial(searchText: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        dispatch(updateSearchText(searchText));
        if (shouldSearchInitial(getState(), searchText)) {
            if (searchText.toLowerCase() === 'trending') {
                return dispatch(searchCategory({tagName: searchText}));
            }
            return dispatch(searchGfycat({searchText}));
        }
        return Promise.resolve();
    };
}

export function shouldSearchInitial(state: GlobalState, searchText: string) {
    const resultsByTerm = state.entities.gifs.search.resultsByTerm[searchText];
    if (!resultsByTerm) {
        return true;
    } else if (resultsByTerm.isFetching) {
        return false;
    }

    return false;
}

export function searchById(gfyId: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {GfycatAPIKey, GfycatAPISecret} = getState().entities.general.config;
        dispatch(requestSearchById(gfyId));
        return gfycatSdk(GfycatAPIKey!, GfycatAPISecret!).searchById({id: gfyId}).then(
            (response: any) => {
                dispatch(receiveSearchById(gfyId, response.gfyItem));
                dispatch(cacheGifsRequest([response.gfyItem]));
            },
        ).catch((err: any) => dispatch(errorSearchById(err, gfyId)));
    };
}

export function shouldSearchById(state: GlobalState, gfyId: string) {
    return !state.entities.gifs.cache.gifs[gfyId]; //TODO investigate, used to be !state.cache.gifs[gfyId];
}

export function searchByIdIfNeeded(gfyId: string) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        if (shouldSearchById(getState(), gfyId)) {
            return dispatch(searchById(gfyId));
        }

        return Promise.resolve(getState().entities.gifs.cache.gifs[gfyId]); //TODO: investigate, used to be getState().cache.gifs[gfyId]
    };
}

export function saveSearchScrollPosition(scrollPosition: number) {
    return (dispatch: DispatchFunc) => {
        dispatch(searchScrollPosition(scrollPosition));
    };
}

export function saveSearchPriorLocation(priorLocation: number) {
    return (dispatch: DispatchFunc) => {
        dispatch(searchPriorLocation(priorLocation));
    };
}

export function searchTextUpdate(searchText: string) {
    return (dispatch: DispatchFunc) => {
        dispatch(updateSearchText(searchText));
    };
}

export function saveSearchBarText(searchBarText: string) {
    return (dispatch: DispatchFunc) => {
        dispatch(searchBarTextSave(searchBarText));
    };
}

// CATEGORIES

export function categoriesListRequest() {
    return {
        type: GifTypes.REQUEST_CATEGORIES_LIST,
    };
}

export function categoriesListReceived(json: any) {
    return {
        type: GifTypes.CATEGORIES_LIST_RECEIVED,
        ...json,
    };
}

export function categoriesListFailure(err: any) {
    return {
        type: GifTypes.CATEGORIES_LIST_FAILURE,
        err,
    };
}

export function requestCategoriesList({count = 60} = {}) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {GfycatAPIKey, GfycatAPISecret} = getState().entities.general.config;
        const state = getState().entities.gifs.categories;
        if (!shouldRequestCategoriesList(state)) {
            return Promise.resolve();
        }
        dispatch(categoriesListRequest());
        const {cursor} = state;
        const options = {
            ...(count && {count}),
            ...(cursor && {cursor}),
        };
        return gfycatSdk(GfycatAPIKey!, GfycatAPISecret!).getCategories(options).then((json: any) => {
            const newGfycats = json.tags.reduce((gfycats: any[], tag: any) => {
                if (tag.gfycats[0] && tag.gfycats[0].width) {
                    return [...gfycats, ...tag.gfycats];
                }
                return gfycats;
            }, []);
            dispatch(cacheGifsRequest(newGfycats));
            dispatch(categoriesListReceived(json));
        }).catch(
            (err: any) => {
                dispatch(categoriesListFailure(err));
            },
        );
    };
}

export function requestCategoriesListIfNeeded({
    count,
} = {count: undefined}) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState().entities.gifs.categories;
        if (state.tagsList && state.tagsList.length) {
            return Promise.resolve();
        }
        return dispatch(requestCategoriesList({count}));
    };
}

export function shouldRequestCategoriesList(state: {hasMore: boolean; isFetching: boolean; tagsList: any[]}) {
    const {hasMore, isFetching, tagsList} = state;
    if (!tagsList || !tagsList.length) {
        return true;
    } else if (isFetching) {
        return false;
    } else if (hasMore) {
        return true;
    }
    return false;
}

// CACHE

export function cacheRequest() {
    return {
        type: GifTypes.CACHE_REQUEST,
        payload: {
            updating: true,
        },
    };
}

export function cacheGifs(gifs: any) {
    return {
        type: GifTypes.CACHE_GIFS,
        gifs,
    };
}

export function cacheGifsRequest(gifs: any) {
    return async (dispatch: DispatchFunc) => {
        dispatch(cacheRequest());
        dispatch(cacheGifs(gifs));
        return {data: true};
    };
}
