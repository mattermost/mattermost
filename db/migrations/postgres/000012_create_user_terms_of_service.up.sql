-- This migration depends on users table
CREATE TABLE IF NOT EXISTS usertermosofservice (
    userid VARCHAR(26) PRIMARY KEY,
    termsofserviceid VARCHAR(26),
    createat bigint
);

CREATE INDEX IF NOT EXISTS idx_user_terms_of_service_user_id ON usertermosofservice (userid);

INSERT INTO usertermosofservice
    SELECT id, acceptedtermsofserviceid as termsofserviceid, (extract(epoch from now()) * 1000)
    FROM users
    WHERE acceptedtermsofserviceid != ''
    AND acceptedtermsofserviceid IS NOT NULL;
