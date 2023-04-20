import {REMOVED_FROM_CHANNEL} from 'src/types/actions';
import reducer from 'src/reducer';

describe('myPlaybookRunsByTeam', () => {
    // @ts-ignore
    const initialState = reducer(undefined, {}); // eslint-disable-line no-undefined

    describe('REMOVED_FROM_CHANNEL', () => {
        const makeState = (myPlaybookRunsByTeam: any) => ({
            ...initialState,
            myPlaybookRunsByTeam,
        });

        it('should ignore a channel not in the data structure', () => {
            const state = makeState({
                teamId1: {
                    channelId1: {id: 'playbookRunId1'},
                    channelId2: {id: 'playbookRunId2'},
                },
                teamId2: {
                    channelId3: {id: 'playbookRunId3'},
                    channelId4: {id: 'playbookRunId4'},
                },
            });
            const action = {
                type: REMOVED_FROM_CHANNEL,
                channelId: 'unknown',
            };
            const expectedState = state;

            // @ts-ignore
            expect(reducer(state, action)).toStrictEqual(expectedState);
        });

        it('should remove a channel in the data structure', () => {
            const state = makeState({
                teamId1: {
                    channelId1: {id: 'playbookRunId1'},
                    channelId2: {id: 'playbookRunId2'},
                },
                teamId2: {
                    channelId3: {id: 'playbookRunId3'},
                    channelId4: {id: 'playbookRunId4'},
                },
            });
            const action = {
                type: REMOVED_FROM_CHANNEL,
                channelId: 'channelId2',
            };
            const expectedState = makeState({
                teamId1: {
                    channelId1: {id: 'playbookRunId1'},
                },
                teamId2: {
                    channelId3: {id: 'playbookRunId3'},
                    channelId4: {id: 'playbookRunId4'},
                },
            });

            // @ts-ignore
            expect(reducer(state, action)).toEqual(expectedState);
        });
    });
});
