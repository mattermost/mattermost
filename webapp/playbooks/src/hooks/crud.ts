import {useEffect, useMemo, useState} from 'react';
import debounce from 'debounce';
import {useIntl} from 'react-intl';

import {useSelector} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {
    archivePlaybook as clientArchivePlaybook,
    duplicatePlaybook as clientDuplicatePlaybook,
    clientFetchPlaybook,
    clientFetchPlaybooks,
    restorePlaybook as clientRestorePlaybook,
    fetchMyCategories,
    savePlaybook,
} from 'src/client';
import {FetchPlaybooksParams, Playbook, PlaybookWithChecklist} from 'src/types/playbook';
import {useToaster} from 'src/components/backstage/toast_banner';
import {Category} from 'src/types/category';

import {useThing} from './general';

type ParamsState = Required<Omit<FetchPlaybooksParams, 'team_id'>>;

const searchDebounceDelayMilliseconds = 300;

export async function getPlaybookOrFetch(id: string, playbooks: Playbook[] | null) {
    return playbooks?.find((p) => p.id === id) ?? clientFetchPlaybook(id);
}

/**
 * Read-only logic to fetch playbook
 * @param id identifier of playbook to fetch
 * @remarks lightweight alternative to {@link usePlaybooksCrud}
 * @returns undefined == loading; null == not found
 */
export function usePlaybook(id: Playbook['id'] | undefined) {
    return useThing(id, clientFetchPlaybook);
}

type EditPlaybookReturn = [PlaybookWithChecklist | undefined, (update: Partial<PlaybookWithChecklist>) => void]

export function useEditPlaybook(id: Playbook['id'], callback?: () => void): EditPlaybookReturn {
    const [playbook, setPlaybook] = useState<PlaybookWithChecklist | undefined>();
    useEffect(() => {
        clientFetchPlaybook(id).then(setPlaybook);
    }, [id]);

    const updatePlaybook = (update: Partial<PlaybookWithChecklist>) => {
        if (playbook) {
            const updatedPlaybook: PlaybookWithChecklist = {...playbook, ...update};
            setPlaybook(updatedPlaybook);
            savePlaybook(updatedPlaybook).then(callback);
        }
    };

    return [playbook, updatePlaybook];
}

export function usePlaybooksCrud(
    defaultParams: Partial<FetchPlaybooksParams>,
    {infinitePaging} = {infinitePaging: false},
) {
    const {formatMessage} = useIntl();
    const teamId = useSelector(getCurrentTeamId);
    const [playbooks, setPlaybooks] = useState<Playbook[] | null>(null);
    const [isLoading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedPlaybook, setSelectedPlaybookState] = useState<Playbook | null>();
    const [params, setParamsState] = useState<ParamsState>({
        sort: 'title',
        direction: 'asc',
        page: 0,
        per_page: 10,
        search_term: '',
        with_archived: false,
        ...defaultParams,
    });

    const setParams = (newParams: Partial<ParamsState>) => {
        setParamsState({...params, ...newParams});
    };

    useEffect(() => {
        fetchPlaybooks();
    }, [params, teamId]);

    const addToast = useToaster().add;

    const setSelectedPlaybook = async (nextSelected: Playbook | string | null) => {
        if (typeof nextSelected !== 'string') {
            return setSelectedPlaybookState(nextSelected);
        }

        if (!nextSelected) {
            return setSelectedPlaybookState(null);
        }

        return setSelectedPlaybookState(await getPlaybookOrFetch(nextSelected, playbooks) ?? null);
    };

    /**
     * Go to specific or next page
     * @param page - defaults to next page if there is one
     */
    const setPage = (page = (hasMore && params.page + 1) || 0) => {
        setParams({page});
    };

    const fetchPlaybooks = async () => {
        setLoading(true);
        const result = await clientFetchPlaybooks(teamId, params);
        if (result) {
            setPlaybooks(infinitePaging && playbooks ? [...playbooks, ...result.items] : result.items);
            setTotalCount(result.total_count);
            setHasMore(result.has_more);
        }
        setLoading(false);
    };

    const archivePlaybook = async (playbookId: Playbook['id']) => {
        await clientArchivePlaybook(playbookId);

        // Fetch latest count
        const result = await clientFetchPlaybooks(teamId, params);

        if (result) {
            // Go back to previous page if the last item on this page was just deleted
            // Setting the page here results in fetching playbooks through the params dependency of the effect above
            setPage(Math.max(Math.min(result.page_count - 1, params.page), 0));
        }
    };

    const restorePlaybook = async (playbookId: Playbook['id']) => {
        await clientRestorePlaybook(playbookId);
        await fetchPlaybooks();
    };

    const duplicatePlaybook = async (playbookId: Playbook['id']) => {
        await clientDuplicatePlaybook(playbookId);
        await fetchPlaybooks();
        addToast({content: formatMessage({defaultMessage: 'Successfully duplicated playbook'})});
    };

    const sortBy = (colName: FetchPlaybooksParams['sort']) => {
        if (params.sort === colName) {
            // we're already sorting on this column; reverse the direction
            const newSortDirection = params.direction === 'asc' ? 'desc' : 'asc';
            setParams({direction: newSortDirection});
            return;
        }

        setParams({sort: colName, direction: 'desc'});
    };

    const setSearchTermDebounced = useMemo(
        () => debounce(
            (term: string) => {
                setLoading(true);
                setParams({search_term: term, page: 0});
            },
            searchDebounceDelayMilliseconds
        ),
        [setLoading, setParams],
    );

    const setWithArchived = (with_archived: boolean) => {
        setLoading(true);
        setParams({with_archived});
    };

    const isFiltering = (params?.search_term?.length ?? 0) > 0;

    return {
        playbooks,

        isLoading,
        totalCount,
        hasMore,
        params,
        selectedPlaybook,

        setPage,
        setParams,
        sortBy,
        setSelectedPlaybook,
        archivePlaybook,
        restorePlaybook,
        duplicatePlaybook,
        setSearchTerm: setSearchTermDebounced,
        setWithArchived,
        isFiltering,
        fetchPlaybooks,
    };
}

/**
 * Read-only logic to fetch categories
 * @param team_id identifier of the team of current user to fetch categories from
 * @returns [] == loading or fetch error
 */
export function useCategories(team_id: string) {
    const [categories, setCategories] = useState([] as Category[]);

    useEffect(() => {
        if (!team_id) {
            setCategories([]);
            return;
        }
        fetchMyCategories(team_id)
            .then(setCategories)
            .catch(() => setCategories([]));
    }, [team_id]);

    return categories;
}
