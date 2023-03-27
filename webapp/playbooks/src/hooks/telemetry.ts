import {useEffect} from 'react';

import {telemetryEventForPlaybook, telemetryEventForPlaybookRun, telemetryView} from 'src/client';
import {PlaybookRunViewTarget, PlaybookViewTarget, TelemetryViewTarget} from 'src/types/telemetry';

export const useViewTelemetry = (target: TelemetryViewTarget, dep?: string, data = {}) => {
    useEffect(() => {
        if (dep) {
            telemetryView(target, data);
        }
    }, [dep]);
};

export const usePlaybookViewTelemetry = (target: PlaybookViewTarget, playbookID?: string) => {
    useEffect(() => {
        if (playbookID) {
            telemetryEventForPlaybook(playbookID, target);
        }
    }, [playbookID]);
};

export const usePlaybookRunViewTelemetry = (target: PlaybookRunViewTarget, playbookRunID?: string) => {
    useEffect(() => {
        if (playbookRunID) {
            telemetryEventForPlaybookRun(playbookRunID, target);
        }
    }, [playbookRunID]);
};
