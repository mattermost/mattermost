import {GlobalState} from '@mattermost/types/store';
import configureStore, {MockStoreEnhanced} from 'redux-mock-store';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {handleReconnect} from './websocket_events';

const mockStore = configureStore<GlobalState, DispatchFunc>();

jest.mock('@mdi/react', () => ({
    __esModule: true,
    default: jest.fn(),
}));

describe('handleReconnect', () => {
    it('does nothing if there is no current team', async () => {
        const initialState = {
            entities: {
                users: {
                    currentUserId: 'user_id',
                },
                teams: {
                    currentTeamId: '',
                    teams: {},
                },
            },
        } as GlobalState;
        const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(initialState);

        const reconnectHandler = handleReconnect(store.getState, store.dispatch);
        const result = await reconnectHandler();
        expect(result).toBeUndefined();
    });

    it('does nothing if there is no current user', async () => {
        const team = {id: 'team_id', delete_at: 0};
        const initialState = {
            entities: {
                users: {
                    currentUserId: '',
                },
                teams: {
                    currentTeamId: team.id,
                    teams: {
                        [team.id]: team,
                    },
                },
            },
        } as GlobalState;
        const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(initialState);

        const reconnectHandler = handleReconnect(store.getState, store.dispatch);
        const result = await reconnectHandler();
        expect(result).toBeUndefined();
    });
});
