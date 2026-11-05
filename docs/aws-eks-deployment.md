# AWS EKS deployment

The repository includes an AWS-ready image publishing and EKS deployment workflow. This guide covers the AWS and GitHub setup that must exist before a production rollout. No cloud account, API key, database password, or AWS role is stored in Git.

## Required services

- An AWS account with an EKS cluster, worker capacity, and a supported Kubernetes version.
- A MongoDB Atlas cluster or another secured MongoDB deployment reachable from the EKS VPC.
- AWS Load Balancer Controller and Metrics Server installed in the cluster. The ingress creates an internet-facing ALB and the API HPA needs resource metrics.
- GitHub Actions enabled for the repository and GHCR packages enabled.
- A DNS name and an ACM certificate before enabling public HTTPS.

## Configure secrets in Kubernetes

Create the namespace and an application secret from a trusted workstation. Use a strong JWT secret and a database user with access only to the TraceMind database. Restrict Atlas network access to the cluster egress path; do not allow all IPs.

```powershell
kubectl apply -f k8s/namespace.yaml
kubectl -n tracemind create secret generic tracemind-secrets `
  --from-literal=mongodb-uri='mongodb+srv://USER:URL_ENCODED_PASSWORD@CLUSTER/tracemind?retryWrites=true&w=majority' `
  --from-literal=jwt-secret='REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS' `
  --from-literal=openai-api-key=''
```

Omit `openai-api-key` if you want the local rules and keyword retrieval mode. Do not put these values in a checked-in manifest.

GHCR packages are private by default. Either make both TraceMind packages public in GitHub package settings, or create a namespace-scoped pull secret using a GitHub token with read-only package access:

```powershell
kubectl -n tracemind create secret docker-registry ghcr-pull `
  --docker-server=ghcr.io `
  --docker-username=YOUR_GITHUB_USERNAME `
  --docker-password=YOUR_READ_PACKAGES_TOKEN
```

For private images, add `imagePullSecrets: [{name: ghcr-pull}]` under each pod template's `spec` in `k8s/api.yaml` and `k8s/web.yaml` before applying them.

Before the first rollout, create the initial application administrator by running the repository seed script from a trusted workstation with the same `MONGODB_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` values. The seed is idempotent and does not overwrite an existing user's password:

```powershell
npm ci
npm run db:seed
```

## Configure GitHub Actions OIDC

1. In AWS IAM, add GitHub as an OpenID Connect identity provider if it is not already configured. The provider URL is `https://token.actions.githubusercontent.com` and the audience is `sts.amazonaws.com`.
2. Create a role trusted only for this repository and the `main` branch (`repo:OWNER/REPOSITORY:ref:refs/heads/main`). Grant it EKS describe/update access for the target cluster. Avoid long-lived AWS access keys.
3. Grant the role Kubernetes permissions to update the `tracemind` namespace (deployments, services, ingress, config map, and HPA). Add an EKS access entry for the role and bind the minimum required Kubernetes role.
4. In GitHub repository **Settings → Secrets and variables → Actions**, add:

   **Secret**

   - `AWS_DEPLOY_ROLE_ARN`: the IAM role ARN from step 2.

   **Variables**

   - `AWS_EKS_DEPLOY_ENABLED`: `true` to enable automatic EKS deployment.
   - `AWS_REGION`: the cluster region, such as `ap-south-1`.
   - `EKS_CLUSTER_NAME`: the exact cluster name.

5. Update `WEB_ORIGIN` and the host in `k8s/config.yaml` and `k8s/ingress.yaml`. Replace `REPLACE_WITH_ACM_CERTIFICATE_ARN` in `k8s/ingress.yaml` with an ACM certificate ARN for that host, then point DNS to the ALB. The ingress redirects HTTP to HTTPS because production session cookies require TLS.
6. Push to `main`. CI runs tests and image builds. The image workflow publishes versioned GHCR images. The EKS job runs only when `AWS_EKS_DEPLOY_ENABLED` is `true`, applies manifests, selects the commit-tagged images, and waits for the rolling deployments.

If EKS deployment is not enabled, CI and image publishing still run; no AWS deployment is attempted. The first rollout needs the namespace secret and either public GHCR images or the private image pull secret to exist before pods can become ready.

## Manual deploy check

After the workflow completes:

```powershell
kubectl -n tracemind get deployments,pods,services,ingress,hpa
kubectl -n tracemind rollout status deployment/tracemind-api
kubectl -n tracemind rollout status deployment/tracemind-web
kubectl -n tracemind logs deployment/tracemind-api --tail=100
```

The API readiness path is `/api/health`; it reports MongoDB mode only after a successful connection. Review ALB target health, DNS, TLS, Atlas network access, pod events, and CloudWatch/container logs before inviting users.

## Limits of this repository setup

The manifests do not create an EKS cluster, Atlas database, IAM role, OIDC trust, DNS record, or certificate. Those are account-specific resources and must be configured in AWS/GitHub. The workflow and manifests are prepared, and local Docker images are buildable; a real EKS rollout has not been verified without those external resources.
