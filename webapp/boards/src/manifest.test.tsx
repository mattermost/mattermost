// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import manifest, {id, version} from './manifest'

test('Plugin manifest, id and version are defined', () => {
    expect(manifest).toBeDefined()
    expect(manifest.id).toBeDefined()
    expect(manifest.version).toBeDefined()
})

// To ease migration, verify separate export of id and version.
test('Plugin id and version are defined', () => {
    expect(id).toBeDefined()
    expect(version).toBeDefined()
})
