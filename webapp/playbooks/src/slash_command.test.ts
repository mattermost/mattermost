import {GlobalState} from '@mattermost/types/store';
import configureStore, {MockStoreEnhanced} from 'redux-mock-store';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import * as Selectors from 'src/selectors';

import {makeSlashCommandHook} from './slash_command';

const mockStore = configureStore<GlobalState, DispatchFunc>();

jest.mock('@mdi/react', () => ({
    __esModule: true,
    default: jest.fn(),
}));

test('makeSlashCommandHook leaves rejected slash commands unmodified', async () => {
    const inPlaybookRunChannel = jest.spyOn(Selectors, 'inPlaybookRunChannel');
    inPlaybookRunChannel.mockReturnValue(true);

    const initialState = {} as GlobalState;
    const store: MockStoreEnhanced<GlobalState, DispatchFunc> = mockStore(initialState);

    const slashCommandHook = makeSlashCommandHook(store);
    const result = await slashCommandHook(undefined, undefined); //eslint-disable-line no-undefined

    expect(result).toEqual({});
});
