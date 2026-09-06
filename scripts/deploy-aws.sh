#!/usr/bin/env bash
# Build linux/arm64, push to Capveon ECR, roll the practice ECS service.
# Run from the open-sales-practice repo root on a machine that has profiles/private.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

AWS_PROFILE="${AWS_PROFILE:-capveon}"
AWS_REGION="${AWS_REGION:-us-east-1}"
CLUSTER="${CLUSTER:-capveon-prod}"
SERVICE="${SERVICE:-practice}"

aws_cli() {
  docker run --rm \
    -e "AWS_PROFILE=${AWS_PROFILE}" \
    -e "AWS_REGION=${AWS_REGION}" \
    -e "AWS_DEFAULT_REGION=${AWS_REGION}" \
    -v "${HOME}/.aws:/root/.aws:ro" \
    -v /tmp:/tmp \
    amazon/aws-cli "$@"
}

if [ ! -f /tmp/osp-clerk-prod.env ]; then
  echo "Need /tmp/osp-clerk-prod.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source /tmp/osp-clerk-prod.env
set +a

TAG="$(git rev-parse --short HEAD)"
REGISTRY="$(aws_cli ecr describe-repositories --repository-names "capveon-prod-${SERVICE}" \
  --query 'repositories[0].repositoryUri' --output text)"
IMAGE="${REGISTRY}:${TAG}"

echo "Building ${IMAGE}"
docker build --platform linux/arm64 --provenance=false --sbom=false \
  -f apps/web/Dockerfile \
  --build-arg "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}" \
  --build-arg "NEXT_PUBLIC_OSP_APP_NAME=Capveon" \
  --build-arg "NEXT_PUBLIC_OSP_PRODUCT=Practice" \
  --build-arg "NEXT_PUBLIC_OSP_MARK=arch" \
  --build-arg "NEXT_PUBLIC_OSP_TAGLINE=Live calls against the people who own the system." \
  -t "$IMAGE" \
  -t "${REGISTRY}:latest" \
  .

echo "Pushing"
aws_cli ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${REGISTRY%%/*}"
docker push "$IMAGE"
docker push "${REGISTRY}:latest"

echo "Rolling ECS"
TASK_ARN="$(aws_cli ecs describe-services --cluster "$CLUSTER" --services "capveon-prod-${SERVICE}" \
  --query 'services[0].taskDefinition' --output text)"
aws_cli ecs describe-task-definition --task-definition "$TASK_ARN" \
  --query 'taskDefinition' > /tmp/osp-td.json
python3 - "$IMAGE" "$SERVICE" <<'PY'
import json, sys
image, service = sys.argv[1], sys.argv[2]
td = json.load(open("/tmp/osp-td.json"))
for key in (
    "taskDefinitionArn", "revision", "status", "requiresAttributes",
    "compatibilities", "registeredAt", "registeredBy",
):
    td.pop(key, None)
for container in td.get("containerDefinitions", []):
    if container.get("name") == service:
        container["image"] = image
json.dump(td, open("/tmp/osp-td-new.json", "w"))
PY
NEW_ARN="$(aws_cli ecs register-task-definition --cli-input-json file:///tmp/osp-td-new.json \
  --query 'taskDefinition.taskDefinitionArn' --output text)"
aws_cli ecs update-service --cluster "$CLUSTER" --service "capveon-prod-${SERVICE}" \
  --task-definition "$NEW_ARN" >/dev/null
aws_cli ecs wait services-stable --cluster "$CLUSTER" --services "capveon-prod-${SERVICE}"
echo "Deployed ${IMAGE}"
