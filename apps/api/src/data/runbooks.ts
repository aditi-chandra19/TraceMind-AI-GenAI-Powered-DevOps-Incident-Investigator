export interface RunbookSection {
  id: string;
  title: string;
  sourcePath: string;
  lineStart: number;
  lineEnd: number;
  text: string;
}

// Curated first-party operational notes. Line numbers refer to the matching docs/runbooks files.
export const runbookSections: RunbookSection[] = [
  {
    id: 'db-pool-checks',
    title: 'Database connection pool exhaustion',
    sourcePath: 'docs/runbooks/database-pool-exhaustion.md',
    lineStart: 1,
    lineEnd: 11,
    text: 'When connection pool exhaustion is suspected, compare active connections, pool maximum, checkout wait time, and query duration. Check whether connections are returned after errors and whether a recent release increased concurrency. Confirm database health and connection limits before changing pool settings. Do not terminate sessions or change production configuration without an approved change.',
  },
  {
    id: 'kubernetes-restarts',
    title: 'Kubernetes pod restart investigation',
    sourcePath: 'docs/runbooks/kubernetes-restarts.md',
    lineStart: 1,
    lineEnd: 11,
    text: 'For repeated pod restarts, inspect pod status, previous container termination reason, restart count, and namespace events. Check resource requests and limits, node pressure, readiness and liveness probe results, and the deployment revision. Compare timestamps with application logs. Avoid deleting pods or changing workloads until an operator approves a remediation.',
  },
  {
    id: 'request-timeouts',
    title: 'Request and dependency timeout investigation',
    sourcePath: 'docs/runbooks/request-timeouts.md',
    lineStart: 1,
    lineEnd: 11,
    text: 'For request timeouts, identify the failing route and trace/request ID, then compare application latency with downstream dependency latency. Check timeout budgets across callers and dependencies, queue depth, retry volume, and recent deployments. Retries can amplify load; validate retry behavior and dependency health before proposing a setting change. Treat a timeout as a symptom until corroborating evidence identifies its source.',
  },
];
