import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '@mattermost/types/store';

import {loadRolesIfNeeded} from 'mattermost-redux/actions/roles';

import {globalSettings} from 'src/selectors';
import {actionSetGlobalSettings} from 'src/actions';
import {fetchGlobalSettings, notifyConnect} from 'src/client';
import {PlaybookRole} from 'src/types/permissions';

// This component is meant to be registered as RootComponent.
// It will be registered at initialize and "rendered" at login.
const LoginHook = () => {
    const dispatch = useDispatch();
    const hasGlobalSettings = useSelector((state: GlobalState) => Boolean(globalSettings(state)));
    const fetchAndStoreSettings = async () => dispatch(actionSetGlobalSettings(await fetchGlobalSettings()));

    useEffect(() => {
        // Ensure settings fetch
        if (!hasGlobalSettings) {
            fetchAndStoreSettings();
        }

        // Grab roles
        dispatch(loadRolesIfNeeded([PlaybookRole.Member, PlaybookRole.Admin]));

        // Fire the first connect bot event.
        notifyConnect();
    }, []);

    return null;
};

export default LoginHook;
