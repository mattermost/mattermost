terraform {
  required_version = ">= 1.10.0"

  backend "s3" {
    bucket       = "mattermost-tfstate-786759548615-us-east-1"
    key          = "mattermost/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }

    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "mattermost"
      Environment = "academic-demo"
      ManagedBy   = "Terraform"
    }
  }
}
