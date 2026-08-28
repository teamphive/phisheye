# ---------------------------
# ElastiCache
# ---------------------------

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-cache-subnet-group"
  subnet_ids = [for s in aws_subnet.private : s.id]
}

resource "aws_elasticache_cluster" "main" {
  cluster_id      = "${var.project_name}-redis"
  engine          = "redis"
  engine_version  = "7.1"
  node_type       = "cache.t3.micro"
  num_cache_nodes = 1
  port            = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.elasticache.id]

  tags = {
    Name = "${var.project_name}-redis"
  }
}
