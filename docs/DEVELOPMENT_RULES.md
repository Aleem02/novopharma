# Development Rules

1. Do not change approved architecture without explicit approval.
2. Do not add unapproved features.
3. Do not implement V2 functionality during V1.
4. Do not store secrets in source control.
5. Do not store plaintext passwords.
6. Do not expose private keys.
7. Do not allow renderer direct filesystem/database access.
8. Do not bypass database migrations.
9. Do not bypass transactions for financial operations.
10. Do not make billing dependent on internet.
11. Do not silently alter existing database data.
12. Every major feature requires tests.
13. Security-sensitive changes require negative tests.
14. Never invent cryptography.
15. Never weaken security to make a test pass.
16. Stop and report architectural conflicts instead of improvising.
