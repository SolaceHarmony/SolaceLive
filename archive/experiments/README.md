# Experiments

This directory houses exploratory prototypes that are **not** part of the production build. They remain in the repo for reference and future research but should never be imported from `next-server/lib/unified` or the running app.

Current folders:

- `neuromorphic/` — research into neural packet routing and consciousness simulations. See `neuromorphic/docs/README.md` for details.

When cutting releases, you can ignore the entire `next-server/experiments/` tree. If an experiment graduates into the product, migrate it into `lib/unified/**` with proper tests and documentation.
