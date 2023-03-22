import {
    DependencyList,
    MutableRefObject,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {useIntl} from 'react-intl';

import {useDispatch, useSelector} from 'react-redux';
import {DateTime} from 'luxon';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentUserId, getProfilesInCurrentTeam, getUser} from 'mattermost-redux/selectors/entities/users';
import {getChannel as getChannelFromState} from 'mattermost-redux/selectors/entities/channels';
import {getProfilesByIds, getProfilesInTeam} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getPost as getPostFromState} from 'mattermost-redux/selectors/entities/posts';
import {UserProfile} from '@mattermost/types/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {ClientError} from '@mattermost/client';
import {useHistory, useLocation} from 'react-router-dom';
import qs from 'qs';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {useUpdateEffect} from 'react-use';
import {debounce, isEqual} from 'lodash';

import {FetchPlaybookRunsParams, PlaybookRun} from 'src/types/playbook_run';
import {EmptyPlaybookStats} from 'src/types/stats';
import {PROFILE_CHUNK_SIZE} from 'src/constants';
import {
    getRun,
    globalSettings,
    isCurrentUserAdmin,
    noopSelector,
    selectExperimentalFeatures,
} from 'src/selectors';
import {
    clientFetchPlaybook,
    fetchPlaybookRun,
    fetchPlaybookRunMetadata,
    fetchPlaybookRunStatusUpdates,
    fetchPlaybookRuns,
    fetchPlaybookStats,
} from 'src/client';
import {isCloud} from 'src/license';
import {resolve} from 'src/utils';

export type FetchMetadata = {
    isFetching: boolean;
    error: ClientError | null;
}

/**
 * Hook that calls handler when targetKey is pressed.
 */
export function useKeyPress(targetKey: string | ((e: KeyboardEvent) => boolean), handler: () => void) {
    const predicate: (e: KeyboardEvent) => boolean = useMemo(() => {
        if (typeof targetKey === 'string') {
            return (e: KeyboardEvent) => e.key === targetKey;
        }

        return targetKey;
    }, [targetKey]);

    // Add event listeners
    useEffect(() => {
        // If pressed key is our target key then set to true
        function downHandler(e: KeyboardEvent) {
            if (predicate(e)) {
                handler();
            }
        }

        window.addEventListener('keydown', downHandler);

        // Remove event listeners on cleanup
        return () => {
            window.removeEventListener('keydown', downHandler);
        };
    }, [handler, predicate]);
}

/**
 * Hook that alerts clicks outside of the passed ref.
 */
export function useClickOutsideRef(
    ref: MutableRefObject<HTMLElement | null>,
    handler?: () => void,
) {
    useEffect(() => {
        function onMouseDown(event: MouseEvent) {
            const target = event.target as any;
            if (
                ref.current &&
                target instanceof Node &&
                !ref.current.contains(target)
            ) {
                handler?.();
            }
        }

        // Bind the event listener
        document.addEventListener('mousedown', onMouseDown);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener('mousedown', onMouseDown);
        };
    }, [ref, handler]);
}

/**
 * Hook that sets a timeout and will cleanup after itself. Adapted from Dan Abramov's code:
 * https://overreacted.io/making-setinterval-declarative-with-react-hooks/
 */
export function useTimeout(callback: () => void, delay: number | null) {
    const timeoutRef = useRef<number>();
    const callbackRef = useRef(callback);

    // Remember the latest callback:
    //
    // Without this, if you change the callback, when setTimeout kicks in, it
    // will still call your old callback.
    //
    // If you add `callback` to useEffect's deps, it will work fine but the
    // timeout will be reset.
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Set up the timeout:
    useEffect(() => {
        if (typeof delay === 'number') {
            timeoutRef.current = window.setTimeout(
                () => callbackRef.current(),
                delay,
            );

            // Clear timeout if the component is unmounted or the delay changes:
            return () => window.clearTimeout(timeoutRef.current);
        }
        return () => false;
    }, [delay]);

    // In case you want to manually clear the timeout from the consuming component...:
    return timeoutRef;
}

// useClientRect will be called only when the component mounts and unmounts, so changes to the
// component's size will not cause rect to change. If you want to be notified of changes after
// mounting, you will need to add ResizeObserver to this hook.
export function useClientRect() {
    const [rect, setRect] = useState(new DOMRect());

    const ref = useCallback((node) => {
        if (node !== null) {
            setRect(node.getBoundingClientRect());
        }
    }, []);

    return [rect, ref] as const;
}

export function useCanCreatePlaybooksInTeam(teamId: string) {
    return useSelector(
        (state: GlobalState) => haveITeamPermission(state, teamId, 'playbook_public_create') || haveITeamPermission(state, teamId, 'playbook_private_create')
    );
}

// lockProfilesInTeamFetch and lockProfilesInChannelFetch prevent concurrently fetching profiles
// from multiple components mounted at the same time, only to all fetch the same data.
//
// Ideally, we would offload this to a Redux saga in the webapp and simply dispatch a
// FETCH_PROFILES_IN_TEAM that handles all this complexity itself.
const lockProfilesInTeamFetch = new Set<string>();
const lockProfilesInChannelFetch = new Set<string>();

// clearLocks is exclusively for testing.
export function clearLocks() {
    lockProfilesInTeamFetch.clear();
    lockProfilesInChannelFetch.clear();
}

// useProfilesInTeam ensures at least the first page of team members has been loaded into Redux.
//
// This pattern relieves components from having to issue their own directives to populate the
// Redux cache when rendering in contexts where the webapp doesn't already do this itself.
//
// Since we never discard Redux metadata, this hook will fetch successfully at most once. If there
// are already members in the team, the hook skips the fetch altogether. If the fetch fails, the
// hook won't try again unless the containing component is re-mounted.
//
// A global lockProfilesInTeamFetch cache avoids the thundering herd problem of many components
// wanting the same metadata.
export function useProfilesInTeam() {
    const dispatch = useDispatch();
    const profilesInTeam = useSelector(getProfilesInCurrentTeam);
    const currentTeamId = useSelector(getCurrentTeamId);

    useEffect(() => {
        if (profilesInTeam.length > 0) {
            // As soon as we successfully fetch a team's profiles, clear the bit that prevents
            // concurrent fetches. We won't try again since we shouldn't forget these profiles,
            // but we also don't want to unexpectedly block this forever.
            lockProfilesInTeamFetch.delete(currentTeamId);
            return;
        }

        // Avoid issuing multiple concurrent fetches for this team.
        if (lockProfilesInTeamFetch.has(currentTeamId)) {
            return;
        }
        lockProfilesInTeamFetch.add(currentTeamId);

        dispatch(getProfilesInTeam(currentTeamId, 0, PROFILE_CHUNK_SIZE));
    }, [currentTeamId, profilesInTeam]);

    return profilesInTeam;
}

export function useCanRestrictPlaybookCreation() {
    const settings = useSelector(globalSettings);
    const isAdmin = useSelector(isCurrentUserAdmin);
    const currentUserID = useSelector(getCurrentUserId);

    // This is really a loading state so just assume no.
    if (!settings) {
        return false;
    }

    // No restrictions if user is a system administrator.
    if (isAdmin) {
        return true;
    }

    return settings.playbook_creators_user_ids.includes(currentUserID);
}

export function useExperimentalFeaturesEnabled() {
    return useSelector(selectExperimentalFeatures);
}

/**
 * Use thing from API and/or Store
 *
 * @param id The ID of the thing to fetch
 * @param fetchFunc required thing fetcher function
 * @param select thing from store if available (noopSelector if no store)
 * @param deps Additional deps that might be needed to trigger again the fetch func
 *
 * @returns Array with data in first parameter and metadata in the second.
 */
export function useThing<T extends NonNullable<any>>(
    id: string| undefined,
    fetchFunc: (id: string) => Promise<T>,
    select: (state: GlobalState, id: string) => T|undefined = noopSelector,
    deps: DependencyList = [],
) {
    const [thing, setThing] = useState<T | null>();
    const thingFromState = useSelector<GlobalState, T | null>((state) => select?.(state, id || '') ?? null);
    const [error, setError] = useState<ClientError | null>(null);
    const [isFetching, setIsFetching] = useState<boolean>(true);

    useEffect(() => {
        if (!id) {
            setIsFetching(false);
            setThing(null);
            setError(null);
            return;
        }

        if (thingFromState) {
            setThing(thingFromState);
            setIsFetching(false);
            return;
        }

        fetchFunc(id)
            .then((res) => {
                setThing(res);
            })
            .catch((err) => {
                if (err instanceof ClientError) {
                    setError(err);
                }
                setThing(null);
            });
        setIsFetching(false);
    }, [thingFromState, id, ...deps]);

    const metadata = {
        isFetching,
        error,
        isErrorCode: (code: number) => {
            return error !== null && error.status_code === code;
        },
    };
    return [thing, metadata] as const;
}

export function usePost(postId: string) {
    return useThing(postId, Client4.getPost, getPostFromState);
}

export function useRun(runId: string, teamId?: string, channelId?: string) {
    return useThing(runId, fetchPlaybookRun, getRun(runId, teamId, channelId));
}

/**
 * Read-only logic to fetch playbook run metadata
 * @param id identifier of the run to fetch metadata
 * @returns data and fetchState in a array tuple
 */
export function useRunMetadata(id: PlaybookRun['id'] | undefined, deps: DependencyList = []) {
    return useThing(id, fetchPlaybookRunMetadata, noopSelector, deps);
}

/**
 * Read-only logic to fetch playbook run status udpates
 * @param id identifier of the playbook run to fetch updates
 * @param deps Array of additional deps whose change will invoke again fetch
 * @returns data and fetchState in a array tuple
 */
export function useRunStatusUpdates(id: PlaybookRun['id'] | undefined, deps: DependencyList = []) {
    return useThing(id, fetchPlaybookRunStatusUpdates, noopSelector, deps);
}

export function useChannel(channelId: string) {
    return useThing(channelId, Client4.getChannel, getChannelFromState);
}

export function useDropdownPosition(numOptions: number, optionWidth = 264) {
    const [dropdownPosition, setDropdownPosition] = useState({x: 0, y: 0, isOpen: false});

    const toggleOpen = (x: number, y: number) => {
        // height of the dropdown:
        const numOptionsShown = Math.min(6, numOptions);
        const selectBox = 56;
        const spacePerOption = 40;
        const bottomPadding = 12;
        const extraSpace = 20;
        const dropdownBottom = y + selectBox + spacePerOption + (numOptionsShown * spacePerOption) + bottomPadding + extraSpace;
        const deltaY = Math.max(0, dropdownBottom - window.innerHeight);

        const dropdownRight = x + optionWidth + extraSpace;
        const deltaX = Math.max(0, dropdownRight - window.innerWidth);

        const shiftedX = x - deltaX;
        const shiftedY = y - deltaY;
        setDropdownPosition({x: shiftedX, y: shiftedY, isOpen: !dropdownPosition.isOpen});
    };
    return [dropdownPosition, toggleOpen] as const;
}

type StringToUserProfileFn = (id: string) => UserProfile;

export function useEnsureProfile(userId: string) {
    const userIds = useMemo(() => [userId], [userId]);
    useEnsureProfiles(userIds);
}

export function useEnsureProfiles(userIds: string[]) {
    const dispatch = useDispatch();
    const getUserFromStore = useSelector<GlobalState, StringToUserProfileFn>(
        (state) => (id: string) => getUser(state, id),
    );

    useEffect(() => {
        const unknownIds = userIds.filter((userId) => !getUserFromStore(userId));
        if (unknownIds.length > 0) {
            dispatch(getProfilesByIds(unknownIds));
        }
    }, [userIds]);
}

export function useOpenCloudModal() {
    const dispatch = useDispatch();
    const isServerCloud = useSelector(isCloud);

    if (!isServerCloud) {
        return () => {
            /*do nothing*/
        };
    }

    // @ts-ignore
    if (!window.WebappUtils?.modals?.openModal || !window.WebappUtils?.modals?.ModalIdentifiers?.CLOUD_PURCHASE || !window.Components?.PurchaseModal) {
        // eslint-disable-next-line no-console
        console.error('unable to open cloud modal');

        return () => {
            /*do nothing*/
        };
    }

    // @ts-ignore
    const {openModal, ModalIdentifiers} = window.WebappUtils.modals;

    // @ts-ignore
    const PurchaseModal = window.Components.PurchaseModal;

    return () => {
        dispatch(
            openModal({
                modalId: ModalIdentifiers.CLOUD_PURCHASE,
                dialogType: PurchaseModal,
                dialogProps: {
                    callerCTA: 'playbooks',
                },
            }),
        );
    };
}

export function useFormattedUsername(user: UserProfile) {
    const teamnameNameDisplaySetting =
        useSelector<GlobalState, string | undefined>(
            getTeammateNameDisplaySetting,
        ) || '';

    return displayUsername(user, teamnameNameDisplaySetting);
}

export function useFormattedUsernameByID(userId: string) {
    const user = useSelector<GlobalState, UserProfile>((state) =>
        getUser(state, userId),
    );

    return useFormattedUsername(user);
}

// Return the list of names of the users given a list of UserProfiles or userIds
// It will respect teamnameNameDisplaySetting.
export function useFormattedUsernames(usersOrUserIds?: Array<UserProfile | string>): string[] {
    const teammateNameDisplaySetting = useSelector<GlobalState, string | undefined>(
        getTeammateNameDisplaySetting,
    ) || '';
    const displayNames = useSelector((state: GlobalState) => {
        return usersOrUserIds?.map((user) => displayUsername(typeof user === 'string' ? getUser(state, user) : user, teammateNameDisplaySetting));
    });
    return displayNames || [];
}

export function useNow(refreshIntervalMillis = 1000) {
    const [now, setNow] = useState(DateTime.now());

    useEffect(() => {
        const tick = () => {
            setNow(DateTime.now());
        };
        const timerId = setInterval(tick, refreshIntervalMillis);

        return () => {
            clearInterval(timerId);
        };
    }, [refreshIntervalMillis]);

    return now;
}

const combineQueryParameters = (oldParams: FetchPlaybookRunsParams, searchString: string) => {
    const queryParams = qs.parse(searchString, {ignoreQueryPrefix: true});
    return {...oldParams, ...queryParams};
};

export function useRunsList(defaultFetchParams: FetchPlaybookRunsParams, routed = true):
[PlaybookRun[], number, FetchPlaybookRunsParams, React.Dispatch<React.SetStateAction<FetchPlaybookRunsParams>>] {
    const [playbookRuns, setPlaybookRuns] = useState<PlaybookRun[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const history = useHistory();
    const location = useLocation();
    const currentTeamId = useSelector(getCurrentTeamId);
    const [fetchParams, setFetchParams] = useState(combineQueryParameters(defaultFetchParams, location.search));

    // Fetch the queried runs
    useEffect(() => {
        let isCanceled = false;

        async function fetchPlaybookRunsAsync() {
            const playbookRunsReturn = await fetchPlaybookRuns({...fetchParams, team_id: currentTeamId});

            if (!isCanceled) {
                setPlaybookRuns((existingRuns: PlaybookRun[]) => {
                    if (fetchParams.page === 0) {
                        return playbookRunsReturn.items;
                    }
                    return [...existingRuns, ...playbookRunsReturn.items];
                });
                setTotalCount(playbookRunsReturn.total_count);
            }
        }

        fetchPlaybookRunsAsync();

        return () => {
            isCanceled = true;
        };
    }, [fetchParams, currentTeamId]);

    // Update the query string when the fetchParams change
    useEffect(() => {
        if (routed) {
            const newFetchParams: Record<string, unknown> = {...fetchParams};
            delete newFetchParams.page;
            delete newFetchParams.per_page;
            history.replace({...location, search: qs.stringify(newFetchParams, {addQueryPrefix: false, arrayFormat: 'brackets'})});
        }
    }, [fetchParams, history]);

    return [playbookRuns, totalCount, fetchParams, setFetchParams];
}

export const usePlaybookName = (playbookId: string) => {
    const [playbookName, setPlaybookName] = useState('');

    useEffect(() => {
        const getPlaybookName = async () => {
            if (playbookId !== '') {
                try {
                    const playbook = await clientFetchPlaybook(playbookId);
                    setPlaybookName(playbook?.title || '');
                } catch {
                    setPlaybookName('');
                }
            }
        };

        getPlaybookName();
    }, [playbookId]);

    return playbookName;
};

export const useStats = (playbookId: string) => {
    const [stats, setStats] = useState(EmptyPlaybookStats);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const ret = await fetchPlaybookStats(playbookId);
                setStats(ret);
            } catch {
                setStats(EmptyPlaybookStats);
            }
        };

        fetchStats();
    }, [playbookId]);

    return stats;
};

/**
 * Hook that returns the previous value of the prop passed as argument
 */
export const usePrevious = (value: any) => {
    const ref = useRef();

    useEffect(() => {
        ref.current = value;
    });

    return ref.current;
};

export const useScrollListener = (el: HTMLElement | null, listener: EventListener) => {
    useEffect(() => {
        if (el === null) {
            return () => { /* do nothing*/ };
        }

        el.addEventListener('scroll', listener);
        return () => el.removeEventListener('scroll', listener);
    }, [el, listener]);
};

/**
 * For controlled props or other pieces of state that need immediate updates with a debounced side effect.
 * @remarks
 * This is a problem solving hook; it is not intended for general use unless it is specifically needed.
 * Also consider {@link https://github.com/streamich/react-use/blob/master/docs/useDebounce.md react-use#useDebounce}.
 *
 * @example
 * const [debouncedValue, setDebouncedValue] = useState('…');
 * const [val, setVal] = useProxyState(debouncedValue, setDebouncedValue, 500);
 * const input = <input type='text' value={val} onChange={({currentTarget}) => setVal(currentTarget.value)}/>;
 */
export const useProxyState = <T>(
    prop: T,
    onChange: (val: T) => void,
    wait = 500,
): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const check = useRef(prop);
    const [value, setValue] = useState(prop);

    useUpdateEffect(() => {
        if (!isEqual(value, check.current)) {
            // check failed; don't destroy pending changes (values set mid-cycle between send/sync)
            return;
        }
        check.current = prop; // sync check
        setValue(prop);
    }, [prop]);

    const onChangeDebounced = useMemo(() => debounce((v) => {
        check.current = v; // send check
        onChange(v);
    }, wait), [wait, onChange]);

    useEffect(() => onChangeDebounced.cancel, [onChangeDebounced]);

    return [value, useCallback((update) => {
        setValue((v) => {
            const newValue = resolve(update, v);
            onChangeDebounced(newValue);
            return newValue;
        });
    }, [setValue, onChangeDebounced])];
};

export const useExportLogAvailable = () => {
    //@ts-ignore plugins state is a thing
    return useSelector<GlobalState, boolean>((state) => Boolean(state.plugins?.plugins?.['com.mattermost.plugin-channel-export']));
};

export enum ReservedCategory {
    Favorite = 'Favorite',
    Runs = 'Runs',
    Playbooks = 'Playbooks'
}

export const useReservedCategoryTitleMapper = () => {
    const {formatMessage} = useIntl();
    return (categoryName: ReservedCategory | string) => {
        switch (categoryName) {
        case ReservedCategory.Favorite:
            return formatMessage({defaultMessage: 'Favorites'});
        case ReservedCategory.Runs:
            return formatMessage({defaultMessage: 'Runs'});
        case ReservedCategory.Playbooks:
            return formatMessage({defaultMessage: 'Playbooks'});
        default:
            return categoryName;
        }
    };
};
