data "aws_caller_identity" "current" {}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "files" {
  #checkov:skip=CKV_AWS_145:SSE-S3 with AES256 provides at-rest encryption for this demo; requiring SSE-KMS would add application-role KMS permissions and request costs.
  #checkov:skip=CKV2_AWS_62:Mattermost object storage does not require event-driven processing in this architecture.
  #checkov:skip=CKV_AWS_144:Cross-region replication is intentionally disabled to keep the academic demo within its small budget.
  bucket        = "${var.name_prefix}-files-${random_id.suffix.hex}"
  force_destroy = true
  tags          = { Name = "${var.name_prefix}-files" }
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    id     = "expire-demo-objects"
    status = "Enabled"
    filter {}
    expiration { days = 30 }
    noncurrent_version_expiration { noncurrent_days = 30 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}

# AWS S3 server access logging requires the target bucket to use SSE-S3, not SSE-KMS.
resource "aws_s3_bucket" "access_logs" {
  #checkov:skip=CKV_AWS_145:AWS documentation requires the server-access-log destination bucket to use SSE-S3 for reliable log delivery.
  #checkov:skip=CKV_AWS_18:This is the dedicated S3 server-access-log destination; enabling logging on it would create recursive log delivery.
  #checkov:skip=CKV2_AWS_62:Access-log storage does not require event notifications.
  #checkov:skip=CKV_AWS_144:Cross-region replication is intentionally disabled to keep this academic demo cost-controlled.
  bucket        = "${var.name_prefix}-access-logs-${random_id.suffix.hex}"
  force_destroy = true
  tags          = { Name = "${var.name_prefix}-access-logs" }
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket                  = aws_s3_bucket.access_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  rule {
    id     = "expire-access-logs"
    status = "Enabled"
    filter {}
    expiration { days = 90 }
    noncurrent_version_expiration { noncurrent_days = 30 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}

resource "aws_s3_bucket_policy" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowS3ServerAccessLogDelivery"
      Effect    = "Allow"
      Principal = { Service = "logging.s3.amazonaws.com" }
      Action    = "s3:PutObject"
      Resource  = "${aws_s3_bucket.access_logs.arn}/s3-access/*"
      Condition = {
        StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        ArnLike      = { "aws:SourceArn" = aws_s3_bucket.files.arn }
      }
    }]
  })
}

resource "aws_s3_bucket_logging" "files" {
  bucket        = aws_s3_bucket.files.id
  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "s3-access/"
  depends_on    = [aws_s3_bucket_policy.access_logs]
}
