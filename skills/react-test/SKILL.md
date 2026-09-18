---
name: react-test
description: Writes and runs tests for React components, hooks, and pages (React edition of SuperClaude /sc:test) using whatever the project has — Vitest/Jest + Testing Library, MSW, Playwright/Cypress. Use for "write tests", "run the tests", "coverage", "e2e test".
argument-hint: "[path] [--type unit|integration|e2e] [--coverage] [--run-only]"
---

# react-test

Target: `$ARGUMENTS`

## Flags
| Flag | Meaning |
|---|---|
| `--type unit` | Hooks, utilities, single components |
| `--type integration` | Several components + data layer (MSW) together (default) |
| `--type e2e` | User flows with Playwright/Cypress |
| `--coverage` | Measure coverage and report gaps |
| `--run-only` | Don't write new tests; run and analyze failures only |

## Behavioral Flow

1. **Detect** — Use `react-stack` to find the test runner, config, and commands. If no test tooling exists, don't write tests — propose a setup first (Vite→Vitest, Next→Vitest or Jest). Then get a fresh `react-map` and use it to locate code, following its token budget rules. Lines without ` T` are components with no colocated test.
2. **Learn conventions** — Read 2 existing tests; follow their location (colocated / `__tests__`), render helpers (`renderWithProviders`, …), and mocking style.
3. **Decide what to test** — List user-facing behaviors first: rendered output, interactions, loading/error/empty states, edge cases.
4. **Write** — Follow the principles below.
5. **Run** — Run only the target tests first (e.g. `vitest run path`), then the related suite.
6. **Report** — Cases added, failures/flakiness, coverage gaps.

## Principles (Testing Library)

- **Test behavior, not implementation.** Don't assert on internal state, hook call counts, or class names.
- Query priority: `getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByTestId` (last resort).
- Prefer `@testing-library/user-event` over `fireEvent` (`const user = userEvent.setup()`).
- Async: `findBy*` or `waitFor`. Never wait with arbitrary `setTimeout`.
- Network: prefer **MSW** handlers (if detected) over mocking `fetch`/axios directly.
- Reuse existing test helpers for providers (QueryClient, Router, Store, Theme). If none exist, suggest creating `test-utils`.
- TanStack Query: a fresh `QueryClient` per test with `retry: false`.
- Test hooks alone with `renderHook` only when they can't be verified through a component.
- No snapshot tests by default.

## Example

```tsx
describe('LoginForm', () => {
  it('shows an error and does not submit when the email is invalid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

## E2E (Playwright)
- Use role-based locators (`page.getByRole`); never `waitForTimeout`.
- If **Playwright MCP** is connected, explore the flow in a real browser first to confirm selectors and steps, then turn it into test code.
- Put repeated setup such as authentication in `storageState`/fixtures.

## Personas
- To decide test strategy (what to test at which level), use the `react-qa` agent.

## Boundaries
**Will**: behavior-focused tests in the project's tools and conventions, report actual run results
**Will Not**: change product behavior to make tests pass (report bugs instead), hide failures with `it.skip` or weakened assertions
