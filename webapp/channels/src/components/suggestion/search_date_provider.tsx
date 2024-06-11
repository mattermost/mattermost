// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Provider from './provider';
import type {ResultsCallback} from './provider';
import SearchDateSuggestion from './search_date_suggestion';

type DateItem = {label: string; date: string};

export default class SearchDateProvider extends Provider {
    handlePretextChanged(pretext: string, resultsCallback: ResultsCallback<DateItem>) {
        const captured = (/\b(?:on|before|after):\s*(\S*)$/i).exec(pretext.toLowerCase());
        if (captured) {
            const datePrefix = captured[1];

            this.startNewRequest(datePrefix);

            const dates: DateItem[] = Object.assign([], [{label: 'Selected Date', date: datePrefix}]);
            const terms = dates.map((date) => date.date);

            resultsCallback({
                matchedPretext: datePrefix,
                terms,
                items: dates,
                component: SearchDateSuggestion,
            });
        }

        return Boolean(captured);
    }

    allowDividers() {
        return false;
    }

    presentationType() {
        return 'date';
    }
}
