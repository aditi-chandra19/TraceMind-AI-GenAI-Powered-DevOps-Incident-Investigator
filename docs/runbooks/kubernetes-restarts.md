# Kubernetes pod restart investigation

## Investigation steps

1. Inspect pod status, previous container termination reason, restart count, and namespace events.
2. Check resource requests and limits, node pressure, readiness and liveness probe results, and deployment revision.
3. Compare event timestamps with application logs.

## Safe handling

Avoid deleting pods or changing workloads until an operator approves a remediation.
