import React from 'react';
import {useHistory} from 'react-router-dom';

// two navigations whose targets read alike for their first 60 characters: two opens, each with its whole target
export function LongPaths({isMobile}: {isMobile: boolean}) {
    const history = useHistory();
    return (
        <button
            data-testid='header.long_paths--button'
            onClick={() => {
                if (isMobile) {
                    history.push('/help/a-rather-long-path-segment/that-runs-past-sixty-characters/first');
                    return;
                }
                history.push('/help/a-rather-long-path-segment/that-runs-past-sixty-characters/second');
            }}
        />
    );
}
