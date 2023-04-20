import {useSelector} from 'react-redux';

import {isE10LicensedOrDevelopment, isE20LicensedOrDevelopment} from 'src/license';

// useAllowAddMessageToTimelineInCurrentTeam returns whether a user can add a
// post to the timeline in the current team
export function useAllowAddMessageToTimelineInCurrentTeam() {
    return useSelector(isE10LicensedOrDevelopment);
}

// useAllowChannelExport returns whether exporting the channel is allowed
export function useAllowChannelExport() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowPlaybookStatsView returns whether the server is licensed to show
// the stats in the playbook backstage dashboard
export function useAllowPlaybookStatsView() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowPlaybookAndRunMetrics returns whether the server is licensed to
// enter and show playbook and run metrics
export function useAllowPlaybookAndRunMetrics() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowRetrospectiveAccess returns whether the server is licenced for
// the retrospective feature.
export function useAllowRetrospectiveAccess() {
    return useSelector(isE10LicensedOrDevelopment);
}

// useAllowPrivatePlaybooks returns whether the server is licenced for
// creating private playbooks
export function useAllowPrivatePlaybooks() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowSetTaskDueDate returns whether the server is licensed for
// setting / editing checklist item due date
export function useAllowSetTaskDueDate() {
    return useSelector(isE10LicensedOrDevelopment);
}

// useAllowMakePlaybookPrivate returns whether the server is licenced for
// converting public playbooks to private
export function useAllowMakePlaybookPrivate() {
    return useSelector(isE20LicensedOrDevelopment);
}

// useAllowRequestUpdate returns whether the server is licenced for
// requesting an update
export function useAllowRequestUpdate() {
    return useSelector(isE10LicensedOrDevelopment);
}
