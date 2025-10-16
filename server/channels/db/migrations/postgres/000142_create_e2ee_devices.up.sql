CREATE SEQUENCE IF NOT EXISTS E2EEDeviceIdSeq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS E2EEDevices (
	UserId                   VARCHAR(26) NOT NULL,
	DeviceId                 BIGINT      NOT NULL DEFAULT nextval('E2EEDeviceIdSeq'),
	DeviceLabel              TEXT,
	RegistrationId           INTEGER     NOT NULL,
	IdentityKeyPublic        TEXT        NOT NULL,
	IdentityKeyFingerprint 	 TEXT        NOT NULL,
	CreateAt                 BIGINT      NOT NULL DEFAULT 0,
	UpdateAt                 BIGINT      NOT NULL DEFAULT 0,
	DeleteAt                 BIGINT      NOT NULL DEFAULT 0,

	CONSTRAINT PKE2EEDevices PRIMARY KEY (UserId, DeviceId)
);

CREATE INDEX IF NOT EXISTS IdxE2EEDevices ON E2EEDevices (UserId);
