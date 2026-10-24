# ADR-004: Role-Based Access Control

- **Status:** Provisionally approved baseline
- **Sources:** [Roles and Permissions](../01-Requirements/Roles-and-Permissions.md); feature/access-control reference

## Decision
The role set is Admin, President, Corporate Secretary, Operations, Finance, and HR. Authorization must be enforced server-side. Admin does not automatically receive financial edit rights. Operations and Finance can edit delivery financial entries under the current provisional approval. Corporate Secretary permissions remain TBD.

## Consequences
Complete the matrix and test every protected read, mutation, export, and POD request. Do not rely on UI visibility alone.
