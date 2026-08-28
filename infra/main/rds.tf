# ---------------------------
# Relational Database Service
# ---------------------------

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [for s in aws_subnet.private : s.id]

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "db" {
  name = "${var.project_name}-${var.environment}-db-credentials"
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = "phisheye"
    password = random_password.db.result
  })
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t3.micro"

  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = "phisheye"
  username = "phisheye"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  skip_final_snapshot = true
  publicly_accessible = false

  tags = {
    Name = "${var.project_name}-db"
  }
}
