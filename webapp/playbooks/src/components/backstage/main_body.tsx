import React from 'react';
import {
    Redirect,
    Route,
    Switch,
    matchPath,
    useHistory,
    useLocation,
    useRouteMatch,
} from 'react-router-dom';

import {useDispatch, useSelector} from 'react-redux';

import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {useEffectOnce, useLocalStorage, useUpdateEffect} from 'react-use';

import {selectTeam} from 'mattermost-redux/actions/teams';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import PlaybookRun from 'src/components/backstage/playbook_runs/playbook_run/playbook_run';

import PlaybookList from 'src/components/backstage/playbook_list';
import PlaybookEditor from 'src/components/backstage/playbook_editor/playbook_editor';
import {ErrorPageTypes} from 'src/constants';
import {pluginErrorUrl, pluginUrl} from 'src/browser_routing';
import ErrorPage from 'src/components/error_page';
import RunsPage from 'src/components/backstage/runs_page';

const useInitTeamRoutingLogic = () => {
    const dispatch = useDispatch();
    const location = useLocation();
    const {url} = useRouteMatch();
    const teams = useSelector(getMyTeams);
    const currentTeamId = useSelector(getCurrentTeamId);
    const currentUserId = useSelector(getCurrentUserId);

    // ? consider moving to multi-product or plugin infrastructure
    // see https://github.com/mattermost/mattermost-webapp/blob/25043262dbab1fc2f9ac6972b1f1b0b1f9c20ae0/stores/local_storage_store.jsx#L9
    const [prevTeamId, setPrevTeamId] = useLocalStorage(`user_prev_team:${currentUserId}`, teams[0].id, {raw: true});

    /**
     * * These routes will select the proper team they belong too.
     * ! Don't restore prev team on these routes or those routes will redirect back to default route.
     * @see {useDefaultRedirectOnTeamChange}
     */
    const negateTeamRestore = matchPath<{playbookRunId?: string; playbookId?: string;}>(location.pathname, {
        path: [
            `${url}/runs/:playbookRunId`,
            `${url}/playbooks/:playbookId`,
        ],
    });

    useEffectOnce(() => {
        if (prevTeamId && !negateTeamRestore) {
            // restore prev team
            dispatch(selectTeam(prevTeamId));
        }
    });

    useUpdateEffect(() => {
        setPrevTeamId(currentTeamId);
    }, [currentTeamId]);
};

/**
 * Use this hook to redirect back to the default route when a different team is selected while on a team-scoped page.
 * ! This is to ensure that a team mismatch doesn't occur when viewing a Playbook or Run and then selecting another team.
 * @param teamScopedModelTeamId team id from team-scoped entity (e.g. a Playbook or PlaybookRun)
 */
export const useDefaultRedirectOnTeamChange = (teamScopedModelTeamId: string | undefined) => {
    const history = useHistory();
    const currentTeamId = useSelector(getCurrentTeamId);
    useUpdateEffect(() => {
        if (
            currentTeamId &&
            teamScopedModelTeamId &&
            currentTeamId !== teamScopedModelTeamId
        ) {
            // team mismatch, go back to start
            history.push(pluginUrl(''));
        }
    }, [currentTeamId]);
};

const MainBody = () => {
    const match = useRouteMatch();
    useInitTeamRoutingLogic();

    return (
        <Switch>
            <Route
                path={`${match.url}/playbooks/:playbookId`}
            >
                <PlaybookEditor/>
            </Route>
            <Route path={`${match.url}/playbooks`}>
                <PlaybookList/>
            </Route>
            <Redirect
                from={`${match.url}/incidents/:playbookRunId`}
                to={`${match.url}/runs/:playbookRunId`}
            />
            <Route path={`${match.url}/runs/:playbookRunId`}>
                <PlaybookRun/>
            </Route>
            <Redirect
                from={`${match.url}/incidents`}
                to={`${match.url}/runs`}
            />
            <Route path={`${match.url}/runs`}>
                <RunsPage/>
            </Route>
            <Route path={`${match.url}/error`}>
                <ErrorPage/>
            </Route>
            <Route
                path={`${match.url}/start`}
            >
                <PlaybookList firstTimeUserExperience={true}/>
            </Route>
            <Route
                exact={true}
                path={`${match.url}/`}
            >
                <Redirect to={`${match.url}/runs`}/>
            </Route>
            <Route>
                <Redirect to={pluginErrorUrl(ErrorPageTypes.DEFAULT)}/>
            </Route>
        </Switch>
    );
};

export default MainBody;
