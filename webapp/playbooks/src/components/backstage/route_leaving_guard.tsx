// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {Prompt} from 'react-router-dom';

import UnsavedChangesModal from 'src/components/widgets/unsaved_changes_modal';

interface Props {
    when?: boolean | undefined;
    navigate: (path: string) => void;
    shouldBlockNavigation: (location: Location) => boolean;
    onCancel?: () => void;
}

// Credit to: https://michaelchan-13570.medium.com/using-react-router-v4-prompt-with-custom-modal-component-ca839f5faf39
const RouteLeavingGuard = (props: Props) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [lastLocation, setLastLocation] = useState<Location | null>(null);
    const [confirmedNavigation, setConfirmedNavigation] = useState(false);

    const onCancel = () => {
        setModalVisible(false);
        props.onCancel?.();
    };

    // @ts-ignore
    const handleBlockedNavigation = (nextLocation: Location<unknown>): boolean => {
        if (!confirmedNavigation && props.shouldBlockNavigation(nextLocation)) {
            setModalVisible(true);
            setLastLocation(nextLocation);
            return false;
        }
        return true;
    };

    const handleConfirmNavigationClick = () => {
        setModalVisible(false);
        setConfirmedNavigation(true);
    };

    useEffect(() => {
        if (confirmedNavigation && lastLocation) {
            // Navigate to the previous blocked location with your navigate function
            props.navigate(lastLocation.pathname);
        }
    }, [confirmedNavigation, lastLocation]);

    return (
        <>
            <Prompt
                when={props.when}
                message={handleBlockedNavigation}
            />
            <UnsavedChangesModal
                show={modalVisible}
                onConfirm={handleConfirmNavigationClick}
                onCancel={onCancel}
            />
        </>
    );
};

export default RouteLeavingGuard;
