# Experiments

This directory houses exploratory prototypes that are **not** part of the production build. They remain in the repo for reference and future research but should never be imported from `next-server/backend` or the running app.

Current folders:

- `neuromorphic/` — research into neural packet routing and consciousness simulations. See `neuromorphic/docs/README.md` for details.

When cutting releases, you can ignore the entire `archive/experiments/` tree. If an experiment graduates into the product, migrate it into `next-server/backend/**` with proper tests and documentation.
