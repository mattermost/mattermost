-- morph:nontransactional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_postpreviews_previewedinpostid
    ON PostPreviews (PreviewedInPostId);
