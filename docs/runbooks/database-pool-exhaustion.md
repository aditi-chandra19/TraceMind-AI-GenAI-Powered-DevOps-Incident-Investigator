# Database connection pool exhaustion

## Investigation steps

1. Compare active connections, configured pool maximum, checkout wait time, and query duration.
2. Check whether connections are returned after errors and whether a recent release increased concurrency.
3. Confirm database health and connection limits before changing pool settings.

## Safe handling

Do not terminate sessions or change production configuration without an approved change.
