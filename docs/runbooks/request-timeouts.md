# Request and dependency timeout investigation

## Investigation steps

1. Identify the failing route and trace/request ID; compare application and downstream latency.
2. Check timeout budgets across callers and dependencies, queue depth, retry volume, and recent deployments.
3. Validate retry behavior and dependency health before proposing a setting change.

## Safe handling

Treat a timeout as a symptom until corroborating evidence identifies its source.
