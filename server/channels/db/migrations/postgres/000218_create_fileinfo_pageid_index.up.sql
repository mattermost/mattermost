-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fileinfo_pageid ON fileinfo (pageid) WHERE pageid IS NOT NULL;
