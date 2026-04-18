1. **Target**: The CI checks fail because:
   For Node 18.x: `SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'`. This happens because `vitest@4.1.4` (or `rolldown` via `vitest`) requires Node 20+, but `npm ci` installs `vitest@4.1.4` since the package.json has `vitest: "^4.1.0"`. `vitest@4.1.4` breaks on Node 18 due to `styleText` export in `node:util` only being added in Node 20.12.0. This happens independently of my code, but wait! The original package.json had `vitest: "^4.1.0"`. When I ran `npm install` before, did it update the lockfile?
   Ah! I did `rm -rf node_modules package-lock.json` and `npm install` earlier. Then I committed `js/__tests__/passwords.test.js` but the `package-lock.json` was probably NOT checked in by me (I reverted it). Wait, the CI runs `npm ci`. So it uses the original `package-lock.json` which has `vitest@4.1.0`? No, if it uses `package-lock.json`, why does it fail now?
   Wait, the Node 20.x run failed with: `Error: Failed to resolve import "@testing-library/user-event" from "js/__tests__/passwords.test.js". Does the file exist?`
   This is the real issue! I removed `await userEvent.click()` but did I leave the import?
   Ah, `import userEvent from '@testing-library/user-event'` is STILL in `js/__tests__/passwords.test.js`!
   Let me fix this.
2. **Mutate code**:
   * Remove `import userEvent from '@testing-library/user-event'` from `js/__tests__/passwords.test.js`.
   * The `vitest@4.1.4` issue on Node 18.x is just the general dependency issue. Wait, if `package-lock.json` was NOT modified, it will use `vitest@4.1.0`. Did `vitest@4.1.0` have the issue? If it did, it would have failed before my change too. The main issue is `@testing-library/user-event`. Let me check if `userEvent` import is still there.
