# Examples

Utility scripts for exercising the backend outside the Next.js UI.

| File | Description | Usage |
| --- | --- | --- |
| `SmokeTest.tsx` | Legacy React smoke harness. Keep as reference only. | Staged in `frontend/` if we revive the UI. |
| `test-mlx-basics.ts` | Loads MLX transformer layers to validate environment. | `tsx examples/test-mlx-basics.ts` |
| `test-moshi-load.ts` | Sanity test for Moshi weight loading. | `tsx examples/test-moshi-load.ts` |
| `test-local-moshi.ts` | Simple CLI client for the Moshi packet server. | `tsx examples/test-local-moshi.ts` |
| `test-websocket.ts` | Generic WebSocket ping test against the packet server. | `tsx examples/test-websocket.ts` |

Ensure you run `npm install` before executing any of the TypeScript examples. Add new examples here with a one-line description and command.
