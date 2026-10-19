data "aws_caller_identity" "current" {}

resource "aws_iam_role" "instance" {
  name = "${var.name_prefix}-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = { Name = "${var.name_prefix}-ec2-role" }
}
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_role_policy" "application" {
  name = "${var.name_prefix}-application-policy"
  role = aws_iam_role.instance.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.database_password_parameter_name}"
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketLocation", "s3:ListBucketMultipartUploads"]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:${var.log_group_name}:*"
      }
    ]
  })
}
resource "aws_iam_instance_profile" "this" {
  name = "${var.name_prefix}-instance-profile"
  role = aws_iam_role.instance.name
}

locals {
  user_data_template = <<-SCRIPT
    #!/bin/bash
    set -euo pipefail
    dnf install -y docker awscli curl
    systemctl enable --now docker
    DB_PASSWORD="$(aws ssm get-parameter --name '${var.database_password_parameter_name}' --with-decryption --query Parameter.Value --output text --region '${var.aws_region}')"
    docker pull '${var.mattermost_image}'
    docker rm -f mattermost 2>/dev/null || true
    docker run -d --name mattermost --restart unless-stopped \\
      -p 8065:8065 \\
      -e MM_SQLSETTINGS_DRIVERNAME=postgres \\
      -e MM_SQLSETTINGS_DATASOURCE="postgres://%s:%s@%s:5432/%s?sslmode=require&connect_timeout=10" \\
      -e MM_SERVICESETTINGS_SITEURL="http://%s:8065" \\
      -e MM_SERVICESETTINGS_LISTENADDRESS=":8065" \\
      -e MM_FILESETTINGS_DRIVERNAME=amazons3 \\
      -e MM_FILESETTINGS_AMAZONS3BUCKET='${var.s3_bucket_name}' \\
      -e MM_FILESETTINGS_AMAZONS3REGION='${var.aws_region}' \\
      -e MM_FILESETTINGS_AMAZONS3ENDPOINT='s3.${var.aws_region}.amazonaws.com' \\
      -e MM_FILESETTINGS_AMAZONS3SSL=true \\
      --log-driver=awslogs \\
      --log-opt awslogs-region='${var.aws_region}' \\
      --log-opt awslogs-group='${var.log_group_name}' \\
      --log-opt awslogs-stream='mattermost-${var.name_prefix}-%s' \\
      --log-opt awslogs-create-group=false \\
      '${var.mattermost_image}'
    IS_STANDBY='%s'
    HEALTHY=false
    for i in $(seq 1 30); do
      if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8065/api/v4/system/ping >/dev/null; then
        HEALTHY=true
        break
      fi
      sleep 10
    done

    if [ "$HEALTHY" != "true" ]; then
      echo "Mattermost failed its startup health check after 5 minutes" >&2
      if [ "$IS_STANDBY" != "true" ]; then
        exit 1
      fi
    fi

    if [ "$IS_STANDBY" = "true" ] && [ "$HEALTHY" = "true" ]; then
      shutdown -h now
    fi
  SCRIPT
}

resource "aws_instance" "primary" {
  #checkov:skip=CKV_AWS_88:A public address is needed for this low-cost demo without a NAT Gateway; inbound access is restricted to allowed_cidr.
  #checkov:skip=CKV_AWS_126:Detailed monitoring is omitted to preserve the small academic-demo budget.
  ami                         = var.ami_id
  instance_type               = var.instance_type
  ebs_optimized               = true
  subnet_id                   = var.public_subnet_a_id
  vpc_security_group_ids      = [var.application_security_group_id]
  iam_instance_profile        = aws_iam_instance_profile.this.name
  associate_public_ip_address = true
  user_data_replace_on_change = true
  user_data = format(local.user_data_template,
    var.database_username,
    "$DB_PASSWORD",
    var.database_endpoint,
    var.database_name,
    aws_eip.application.public_ip,
    "primary",
    "false"
  )
  root_block_device {
    volume_size           = 12
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }
  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }
  tags       = { Name = "${var.name_prefix}-primary" }
  depends_on = [aws_iam_role_policy_attachment.ssm_core, aws_iam_role_policy.application]
}

resource "aws_instance" "standby" {
  #checkov:skip=CKV_AWS_88:The standby needs outbound internet access during first boot to pull the public container image; inbound access is restricted to allowed_cidr.
  #checkov:skip=CKV_AWS_126:Detailed monitoring is omitted to preserve the small academic-demo budget.
  ami                         = var.ami_id
  instance_type               = var.instance_type
  ebs_optimized               = true
  subnet_id                   = var.public_subnet_b_id
  vpc_security_group_ids      = [var.application_security_group_id]
  iam_instance_profile        = aws_iam_instance_profile.this.name
  associate_public_ip_address = true
  user_data_replace_on_change = true
  user_data = format(local.user_data_template,
    var.database_username,
    "$DB_PASSWORD",
    var.database_endpoint,
    var.database_name,
    aws_eip.application.public_ip,
    "standby",
    "true"
  )
  root_block_device {
    volume_size           = 12
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }
  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }
  tags       = { Name = "${var.name_prefix}-standby" }
  depends_on = [aws_iam_role_policy_attachment.ssm_core, aws_iam_role_policy.application]
}

resource "aws_eip" "application" {
  domain = "vpc"
  tags   = { Name = "${var.name_prefix}-application-eip" }
}
resource "aws_eip_association" "primary" {
  instance_id   = aws_instance.primary.id
  allocation_id = aws_eip.application.id
}
