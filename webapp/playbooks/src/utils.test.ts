import {uniqueId} from './utils';

describe('utils', () => {
    describe('uniqueId', () => {
        it('should handle a missing prefix', () => {
            const id1 = uniqueId();
            const id2 = uniqueId();

            expect(id1).not.toEqual(id2);
        });

        it('should handle a prefix', () => {
            const id1 = uniqueId('prefix');
            const id2 = uniqueId('prefix');
            const otherId1 = uniqueId('other');

            expect(id1).not.toEqual(id2);
            expect(id2).not.toEqual(otherId1);
            expect(otherId1).not.toEqual(id1);
        });
    });
});
