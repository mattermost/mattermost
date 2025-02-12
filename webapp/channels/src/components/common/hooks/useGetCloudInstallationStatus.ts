import {useEffect, useState, useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {getInstallation} from 'actions/cloud';
import { getLicense } from 'mattermost-redux/selectors/entities/general';

export default function useGetCloudInstallationStatus(poll: boolean = false) {
    const [status, setStatus] = useState<string>('');
    const dispatch = useDispatch();
    const license = useSelector(getLicense);

    const fetchStatus = useCallback(async () => {
        if (license.Cloud === 'true') {
            const result = await dispatch(getInstallation());
            if (result.data) {
                setStatus(result.data.state);
            }
        } else {
            setStatus('stable');
        }
    }, [dispatch, license]);

    useEffect(() => {
        fetchStatus();
        if (poll && license.Cloud === 'true') {
            const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
            return () => clearInterval(interval);
        }
    }, [fetchStatus, poll, license]);

    return {status, refetchStatus: fetchStatus};
}
