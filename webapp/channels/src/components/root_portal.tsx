// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import ReactDOM from 'react-dom';

interface Props {
    children: React.ReactNode | React.ReactNodeArray;
}

const RootPortal = ({children}: Props) => {
    const el = useRef<HTMLDivElement>(document.createElement('div'));

    useEffect(() => {
        const element = el.current;

        const rootPortal = document.getElementById('root-portal');

        if (rootPortal) {
            rootPortal.appendChild(element);
        }

        return () => {
            const rootPortal = document.getElementById('root-portal');

            if (rootPortal) {
                rootPortal.removeChild(element);
            }
        };
    }, []);

    return ReactDOM.createPortal(
        children,
        el.current,
    );
};

export default React.memo(RootPortal);
