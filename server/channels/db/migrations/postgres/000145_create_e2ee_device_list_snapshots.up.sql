CREATE TABLE IF NOT EXISTS E2EEDeviceListSnapshots (
	UserId          VARCHAR(26) PRIMARY KEY,
	DeviceListHash  TEXT        NOT NULL DEFAULT '',
	DevicesCount    INTEGER     NOT NULL DEFAULT 0,
	Version         BIGINT      NOT NULL DEFAULT 0,
	UpdateAt        BIGINT      NOT NULL DEFAULT 0
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION E2EERecomputeListSnapshot(p_user_id VARCHAR)
RETURNS VOID
AS $$
DECLARE
	payload TEXT;
	devicesCnt INTEGER;
	vhash TEXT;
BEGIN
	SELECT
		COALESCE(string_agg(DeviceId::TEXT || ':' || IdentityKeyFingerprint, E'\n' ORDER BY DeviceId),''),
		COALESCE(COUNT(*), 0)
	INTO payload, devicesCnt
	FROM E2EEDevices
	WHERE UserId = p_user_id AND DeleteAt = 0;

	vhash := encode(digest(payload, 'sha256'), 'hex');

	INSERT INTO E2EEDeviceListSnapshots (UserId, DeviceListHash, DevicesCount, Version, UpdateAt)
	VALUES (p_user_id, vhash, COALESCE(devicesCnt, 0), 1, EXTRACT(EPOCH FROM clock_timestamp())::BIGINT * 1000)
	ON CONFLICT (UserId) DO UPDATE
		SET DeviceListHash = EXCLUDED.DeviceListHash,
		DevicesCount   = EXCLUDED.DevicesCount,
		Version        = E2EEDeviceListSnapshots.Version + 1,
		UpdateAt       = EXCLUDED.UpdateAt;
END;
$$ LANGUAGE plpgsql;

