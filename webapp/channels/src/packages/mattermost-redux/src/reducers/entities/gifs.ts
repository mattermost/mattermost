// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {GifTypes} from 'mattermost-redux/action_types';

import type {GenericAction} from 'mattermost-redux/types/actions';

type ReducerMap = {[actionType: string]: (state: any, action: GenericAction) => any};

const SEARCH_SELECTORS: ReducerMap = {
    [GifTypes.SELECT_SEARCH_TEXT]: (state: any, action: GenericAction) => ({
        ...state,
        searchText: action.searchText,
    }),
    [GifTypes.INVALIDATE_SEARCH_TEXT]: (state: any, action: GenericAction) => ({
        ...state,
        resultsByTerm: {
            ...state.resultsByTerm[action.searchText],
            didInvalidate: true,
        },
    }),
    [GifTypes.REQUEST_SEARCH]: (state: any, action: GenericAction) => ({
        ...state,
        resultsByTerm: TERM_SELECTOR[action.type](state.resultsByTerm, action),
    }),
    [GifTypes.RECEIVE_SEARCH]: (state: any, action: GenericAction) => ({
        ...state,
        searchText: action.searchText,
        resultsByTerm: TERM_SELECTOR[action.type](state.resultsByTerm, action),
    }),
    [GifTypes.RECEIVE_SEARCH_END]: (state: any, action: GenericAction) => ({
        ...state,
        searchText: action.searchText,
        resultsByTerm: TERM_SELECTOR[action.type](state.resultsByTerm, action),
    }),
    [GifTypes.RECEIVE_CATEGORY_SEARCH]: (state: any, action: GenericAction) => ({
        ...state,
        searchText: action.searchText,
        resultsByTerm: TERM_SELECTOR[action.type](state.resultsByTerm, action),
    }),
    [GifTypes.SEARCH_FAILURE]: (state: any, action: GenericAction) => ({
        ...state,
        searchText: action.searchText,
        resultsByTerm: TERM_SELECTOR[action.type](state.resultsByTerm, action),
    }),
    [GifTypes.CLEAR_SEARCH_RESULTS]: (state: any) => ({
        ...state,
        searchText: '',
        resultsByTerm: {},
    }),
    [GifTypes.SAVE_SEARCH_SCROLL_POSITION]: (state: any, action: GenericAction) => ({
        ...state,
        scrollPosition: action.scrollPosition,
    }),
    [GifTypes.SAVE_SEARCH_PRIOR_LOCATION]: (state: any, action: GenericAction) => ({
        ...state,
        priorLocation: action.priorLocation,
    }),
    [GifTypes.UPDATE_SEARCH_TEXT]: (state: any, action: GenericAction) => ({
        ...state,
        searchText: action.searchText,
    }),
    [GifTypes.SAVE_SEARCH_BAR_TEXT]: (state: any, action: GenericAction) => ({
        ...state,
        searchBarText: action.searchBarText,
    }),
};

const CATEGORIES_SELECTORS: ReducerMap = {
    [GifTypes.REQUEST_CATEGORIES_LIST]: (state: any) => ({
        ...state,
        isFetching: true,
    }),
    [GifTypes.CATEGORIES_LIST_RECEIVED]: (state: any, action: GenericAction) => {
        const {cursor, tags} = action;
        const {tagsList: oldTagsList = []} = state;
        const tagsDict: any = {};
        const newTagsList = tags.filter((item: any) => {
            return Boolean(item && item.gfycats[0] && item.gfycats[0].width);
        }).map((item: any) => {
            tagsDict[item.tag] = true;
            return {
                tagName: item.tag,
                gfyId: item.gfycats[0].gfyId,
            };
        });
        const tagsList = [...oldTagsList, ...newTagsList];
        return {
            ...state,
            cursor,
            hasMore: Boolean(cursor),
            isFetching: false,
            tagsList,
            tagsDict,
        };
    },
    [GifTypes.CATEGORIES_LIST_FAILURE]: (state: any) => ({
        ...state,
        isFetching: false,
    }),
};

const TERM_SELECTOR: ReducerMap = {
    [GifTypes.REQUEST_SEARCH]: (state: any, action: GenericAction) => ({
        ...state,
        [action.searchText]: {
            ...state[action.searchText],
            isFetching: true,
            didInvalidate: false,
            pages: PAGE_SELECTOR[action.type](state[action.searchText], action),
        },
    }),
    [GifTypes.RECEIVE_SEARCH]: (state: any, action: GenericAction) => {
        const gfycats = action.gfycats.filter((item: any) => {
            return Boolean(item.gfyId && item.width && item.height);
        });
        const newItems = gfycats.map((gfycat: any) => gfycat.gfyId);
        return {
            ...state,
            [action.searchText]: {
                ...state[action.searchText],
                isFetching: false,
                items: typeof state[action.searchText] !== 'undefined' &&
                    state[action.searchText].items ?
                    [...state[action.searchText].items, ...newItems] :
                    newItems,
                moreRemaining:
                    typeof state[action.searchText] !== 'undefined' &&
                    state[action.searchText].items ?
                        [
                            ...state[action.searchText].items,
                            ...action.gfycats,
                        ].length < action.found :
                        action.gfycats.length < action.found,
                count: action.count,
                found: action.found,
                start: action.start,
                currentPage: action.currentPage,
                pages: PAGE_SELECTOR[action.type](state[action.searchText], action),
                cursor: action.cursor,
            },
        };
    },
    [GifTypes.RECEIVE_CATEGORY_SEARCH]: (state: any, action: GenericAction) => {
        const gfycats = action.gfycats.filter((item: any) => {
            return Boolean(item.gfyId && item.width && item.height);
        });
        const newItems = gfycats.map((gfycat: any) => gfycat.gfyId);
        return {
            ...state,
            [action.searchText]: {
                ...state[action.searchText],
                isFetching: false,
                items: typeof state[action.searchText] !== 'undefined' &&
                    state[action.searchText].items ?
                    [...state[action.searchText].items, ...newItems] :
                    newItems,
                cursor: action.cursor,
                moreRemaining: Boolean(action.cursor),
            },
        };
    },
    [GifTypes.RECEIVE_SEARCH_END]: (state: any, action: GenericAction) => ({
        ...state,
        [action.searchText]: {
            ...state[action.searchText],
            isFetching: false,
            moreRemaining: false,
        },
    }),
    [GifTypes.SEARCH_FAILURE]: (state: any, action: GenericAction) => ({
        ...state,
        [action.searchText]: {
            ...state[action.searchText],
            isFetching: false,
            items: [],
            moreRemaining: false,
            count: 0,
            found: 0,
            start: 0,
            isEmpty: true,
        },
    }),
};
const PAGE_SELECTOR: ReducerMap = {
    [GifTypes.REQUEST_SEARCH]: (state: {pages?: any} = {}) => {
        if (typeof state.pages == 'undefined') {
            return {};
        }
        return {...state.pages};
    },
    [GifTypes.RECEIVE_SEARCH]: (state: any, action: GenericAction) => ({
        ...state.pages,
        [action.currentPage]: action.gfycats.map((gfycat: any) => gfycat.gfyId),
    }),
};

const CACHE_SELECTORS: ReducerMap = {
    [GifTypes.CACHE_GIFS]: (state: any, action: GenericAction) => ({
        ...state,
        gifs: CACHE_GIF_SELECTOR[action.type](state.gifs, action),
        updating: false,
    }),
    [GifTypes.CACHE_REQUEST]: (state: any, action: GenericAction) => ({
        ...state,
        ...action.payload,
    }),
};

const CACHE_GIF_SELECTOR: ReducerMap = {
    [GifTypes.CACHE_GIFS]: (state: any, action: GenericAction) => ({
        ...state,
        ...action.gifs.reduce((map: any, obj: any) => {
            map[obj.gfyId] = obj;
            return map;
        }, {}),
    }),
};

function appReducer(state: any = {}, action: GenericAction) {
    const nextState = {...state};
    switch (action.type) {
    case GifTypes.SAVE_APP_PROPS:
        return {...nextState, ...action.props};
    default:
        return state;
    }
}

function categoriesReducer(state: any = {}, action: GenericAction) {
    const selector = CATEGORIES_SELECTORS[action.type];
    return selector ? selector(state, action) : state;
}

function searchReducer(state: any = {}, action: GenericAction) {
    const selector = SEARCH_SELECTORS[action.type];
    return selector ? selector(state, action) : state;
}

function cacheReducer(state: any = {}, action: GenericAction) {
    const selector = CACHE_SELECTORS[action.type];
    return selector ? selector(state, action) : state;
}

export default combineReducers({
    app: appReducer,
    categories: categoriesReducer,
    search: searchReducer,
    cache: cacheReducer,
});
