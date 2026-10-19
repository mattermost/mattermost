resource "aws_security_group" "application" {
  #checkov:skip=CKV2_AWS_5:Attachment is configured in the compute module through its input ID; cross-module association is not detected by this graph check.
  name        = "${var.name_prefix}-application-sg"
  description = "Mattermost HTTP ingress with HTTPS-only outbound access."
  vpc_id      = var.vpc_id

  ingress {
    description = "Mattermost HTTP ingress restricted to the configured user CIDR."
    from_port   = 8065
    to_port     = 8065
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  egress {
    description = "HTTPS for container pulls, AWS APIs, SSM, S3 and CloudWatch."
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "PostgreSQL connections to the two private database subnets only."
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.42.11.0/24", "10.42.12.0/24"]
  }

  tags = { Name = "${var.name_prefix}-application-sg" }
}

resource "aws_security_group" "database" {
  #checkov:skip=CKV2_AWS_5:Attachment is configured in the database module through its input ID; cross-module association is not detected by this graph check.
  name        = "${var.name_prefix}-database-sg"
  description = "PostgreSQL accepts connections only from the Mattermost application security group."
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from the application security group only."
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.application.id]
  }

  # No outbound rules are required; security groups are stateful so database responses are allowed.
  egress = []

  tags = { Name = "${var.name_prefix}-database-sg" }
}
