terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "phisheye-tfstate"
    key            = "main/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "phisheye-tfstate-lock"
    encrypt        = true
  }
}