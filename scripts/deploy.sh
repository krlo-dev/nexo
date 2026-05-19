#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Despliegue completo de Nexo SaaS en AWS
# =============================================================================
#
# USO:
#   ./scripts/deploy.sh \
#     --region us-east-1 \
#     --db-password "MiPassword123!" \
#     --jwt-secret "$(openssl rand -hex 32)" \
#     --nvidia-key "nvapi-xxxxxxxxxxxx"
#
# PARÁMETROS OPCIONALES:
#   --stack-name    Nombre del stack (default: nexo-prod)
#   --profile       Perfil AWS CLI (default: default)
#   --nvidia-url    URL de NVIDIA NIM (default: https://integrate.api.nvidia.com/v1)
#   --glm-model     Modelo GLM (default: z-ai/glm-5.1)
#   --instance-type Tipo de instancia EC2 (default: t2.micro)
#   --keypair       Nombre del Key Pair para SSH (opcional)
#   --allow-ssh-from CIDR para SSH (default: 0.0.0.0/0)
#   --skip-build    Saltar el build de imágenes Docker (usa las ya existentes en ECR)
#
# PREREQUISITOS:
#   - AWS CLI instalado y configurado (aws configure)
#   - Docker instalado y corriendo
#   - Permisos IAM: CloudFormation, EC2, ECS, ECR, RDS, IAM
# =============================================================================

set -euo pipefail

# ── Colores para output ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log()     { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${BLUE}══ $* ══${NC}"; }

# ── Valores por defecto ────────────────────────────────────────────────────────
REGION=""
DB_PASSWORD=""
JWT_SECRET=""
NVIDIA_API_KEY=""
NVIDIA_URL="https://integrate.api.nvidia.com/v1"
GLM_MODEL="z-ai/glm-5.1"
STACK_NAME="nexo-prod"
AWS_PROFILE="default"
INSTANCE_TYPE="t3.micro"
DB_INSTANCE_CLASS="db.t3.micro"
KEYPAIR_NAME=""
ALLOW_SSH_FROM="0.0.0.0/0"
SKIP_BUILD=false

# Directorio raíz del proyecto (relativo a este script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Parsear argumentos ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --region)         REGION="$2";           shift 2 ;;
    --db-password)    DB_PASSWORD="$2";       shift 2 ;;
    --jwt-secret)     JWT_SECRET="$2";        shift 2 ;;
    --nvidia-key)     NVIDIA_API_KEY="$2";    shift 2 ;;
    --nvidia-url)     NVIDIA_URL="$2";        shift 2 ;;
    --glm-model)      GLM_MODEL="$2";         shift 2 ;;
    --stack-name)     STACK_NAME="$2";        shift 2 ;;
    --profile)        AWS_PROFILE="$2";       shift 2 ;;
    --instance-type)  INSTANCE_TYPE="$2";     shift 2 ;;
    --keypair)        KEYPAIR_NAME="$2";      shift 2 ;;
    --allow-ssh-from) ALLOW_SSH_FROM="$2";    shift 2 ;;
    --skip-build)     SKIP_BUILD=true;        shift ;;
    *) error "Parámetro desconocido: $1. Usa --help para ver los parámetros disponibles." ;;
  esac
done

# ── Validar parámetros obligatorios ───────────────────────────────────────────
[[ -z "$REGION" ]]        && error "Falta --region (ej: us-east-1)"
[[ -z "$DB_PASSWORD" ]]   && error "Falta --db-password"
[[ -z "$JWT_SECRET" ]]    && error "Falta --jwt-secret (genera con: openssl rand -hex 32)"
[[ -z "$NVIDIA_API_KEY" ]] && error "Falta --nvidia-key"
[[ ${#DB_PASSWORD} -lt 12 ]] && error "--db-password debe tener al menos 12 caracteres"
[[ ${#JWT_SECRET} -lt 32 ]]  && error "--jwt-secret debe tener al menos 32 caracteres"

# ── Verificar dependencias ─────────────────────────────────────────────────────
header "Verificando dependencias"
command -v aws    &>/dev/null || error "AWS CLI no instalado. Ve a: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
command -v docker &>/dev/null || error "Docker no instalado o no está corriendo."
success "AWS CLI y Docker disponibles"

# Verificar credenciales AWS
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text 2>/dev/null) \
  || error "No se pudo autenticar con AWS. Ejecuta: aws configure"
success "Autenticado en AWS — Account: $ACCOUNT_ID"

ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# ── PASO 1: Desplegar CloudFormation ──────────────────────────────────────────
header "Paso 1/4 — Desplegando CloudFormation stack: $STACK_NAME"

CFN_PARAMS=(
  "ParameterKey=DBPassword,ParameterValue=${DB_PASSWORD}"
  "ParameterKey=JwtSecret,ParameterValue=${JWT_SECRET}"
  "ParameterKey=NvidiaApiKey,ParameterValue=${NVIDIA_API_KEY}"
  "ParameterKey=NvidiaNimUrl,ParameterValue=${NVIDIA_URL}"
  "ParameterKey=GlmModel,ParameterValue=${GLM_MODEL}"
  "ParameterKey=EC2InstanceType,ParameterValue=${INSTANCE_TYPE}"
  "ParameterKey=DBInstanceClass,ParameterValue=${DB_INSTANCE_CLASS}"
)
[[ -n "$KEYPAIR_NAME" ]] && CFN_PARAMS+=("ParameterKey=KeyPairName,ParameterValue=${KEYPAIR_NAME}")

aws cloudformation deploy \
  --profile         "$AWS_PROFILE" \
  --region          "$REGION" \
  --template-file   "${PROJECT_DIR}/infra/cloudformation.yml" \
  --stack-name      "$STACK_NAME" \
  --parameter-overrides "${CFN_PARAMS[@]}" \
  --capabilities    CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

success "Stack CloudFormation desplegado correctamente"

# ── Obtener outputs del stack ─────────────────────────────────────────────────
log "Leyendo outputs del stack..."

get_output() {
  aws cloudformation describe-stacks \
    --profile "$AWS_PROFILE" \
    --region  "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

BACKEND_ECR_URI=$(get_output BackendECRUri)
FRONTEND_ECR_URI=$(get_output FrontendECRUri)
APP_URL=$(get_output AppURL)
CLUSTER_NAME=$(get_output ECSClusterName)
SERVICE_NAME=$(get_output ECSServiceName)
DB_ENDPOINT=$(get_output DatabaseEndpoint)

log "  Backend ECR:  $BACKEND_ECR_URI"
log "  Frontend ECR: $FRONTEND_ECR_URI"
log "  App URL:      $APP_URL"
log "  DB Endpoint:  $DB_ENDPOINT"

# ── PASO 2: Login en ECR ──────────────────────────────────────────────────────
header "Paso 2/4 — Autenticando en ECR"

aws ecr get-login-password \
  --profile "$AWS_PROFILE" \
  --region  "$REGION" \
  | docker login \
      --username AWS \
      --password-stdin "$ECR_REGISTRY"

success "Login en ECR exitoso"

# ── PASO 3: Build y push de imágenes Docker ───────────────────────────────────
if [[ "$SKIP_BUILD" == "true" ]]; then
  warn "SKIP_BUILD=true — omitiendo build de imágenes (usando las ya existentes en ECR)"
else
  header "Paso 3/4 — Build y push de imágenes Docker"

  IMAGE_TAG=$(date +%Y%m%d%H%M%S)

  # Backend
  log "Construyendo imagen backend..."
  docker build \
    --platform linux/amd64 \
    --tag "${BACKEND_ECR_URI}:latest" \
    --tag "${BACKEND_ECR_URI}:${IMAGE_TAG}" \
    "${PROJECT_DIR}/backend"

  log "Subiendo backend a ECR..."
  docker push "${BACKEND_ECR_URI}:latest"
  docker push "${BACKEND_ECR_URI}:${IMAGE_TAG}"
  success "Backend subido: ${BACKEND_ECR_URI}:latest"

  # Frontend
  log "Construyendo imagen frontend..."
  docker build \
    --platform linux/amd64 \
    --tag "${FRONTEND_ECR_URI}:latest" \
    --tag "${FRONTEND_ECR_URI}:${IMAGE_TAG}" \
    "${PROJECT_DIR}/frontend"

  log "Subiendo frontend a ECR..."
  docker push "${FRONTEND_ECR_URI}:latest"
  docker push "${FRONTEND_ECR_URI}:${IMAGE_TAG}"
  success "Frontend subido: ${FRONTEND_ECR_URI}:latest"
fi

# ── PASO 4: Iniciar servicio ECS ──────────────────────────────────────────────
header "Paso 4/4 — Iniciando servicio ECS"

log "Esperando que el cluster ECS tenga al menos 1 instancia registrada..."
for i in $(seq 1 20); do
  REGISTERED=$(aws ecs describe-clusters \
    --profile "$AWS_PROFILE" \
    --region  "$REGION" \
    --clusters "$CLUSTER_NAME" \
    --query "clusters[0].registeredContainerInstancesCount" \
    --output text)

  if [[ "$REGISTERED" -ge 1 ]]; then
    success "Cluster con $REGISTERED instancia(s) registrada(s)"
    break
  fi

  if [[ $i -eq 20 ]]; then
    error "Timeout: el cluster ECS no tiene instancias después de 5 minutos. Revisa los logs de la EC2 en CloudWatch."
  fi

  log "  Intento $i/20 — esperando instancia EC2... (${REGISTERED} registradas)"
  sleep 15
done

log "Actualizando servicio ECS a DesiredCount: 1..."
aws ecs update-service \
  --profile              "$AWS_PROFILE" \
  --region               "$REGION" \
  --cluster              "$CLUSTER_NAME" \
  --service              "$SERVICE_NAME" \
  --desired-count        1 \
  --force-new-deployment \
  --query 'service.serviceName' \
  --output text

success "Servicio ECS iniciado con DesiredCount: 1"

# ── Mostrar resultado final ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ Despliegue completado exitosamente${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}URL de la app:${NC}     $APP_URL"
echo -e "  ${BOLD}Cluster ECS:${NC}      $CLUSTER_NAME"
echo -e "  ${BOLD}Servicio ECS:${NC}     $SERVICE_NAME"
echo -e "  ${BOLD}DB Endpoint:${NC}      $DB_ENDPOINT"
echo ""
echo -e "  ${YELLOW}La app puede tardar 2-3 minutos en estar disponible${NC}"
echo -e "  ${YELLOW}mientras ECS hace pull de las imágenes y el backend${NC}"
echo -e "  ${YELLOW}ejecuta las migraciones de base de datos.${NC}"
echo ""
echo -e "  ${BOLD}Ver logs en tiempo real:${NC}"
echo -e "  aws logs tail /ecs/nexo --follow --region $REGION"
echo ""
echo -e "  ${BOLD}Ver estado del servicio:${NC}"
echo -e "  aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION"
echo ""
