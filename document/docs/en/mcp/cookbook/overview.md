# Cookbook

Real-world scenarios showing how to combine MCP tools for common development and testing tasks.

Each recipe walks through a complete workflow — from initial investigation to verification — using conversational prompts you can paste directly into your AI assistant.

## Scenarios

| Recipe                                   | What you'll learn                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| [UI Debugging](./debug-ui)               | Inspect component tree, find elements, examine state to diagnose UI issues   |
| [Network Mocking](./network-mocking)     | Mock API responses, simulate errors and slow networks, verify error handling |
| [Performance Profiling](./performance)   | Profile renders, identify unnecessary re-renders, find optimization targets  |
| [Visual Regression](./visual-regression) | Create baselines, detect visual changes, compare element-level screenshots   |
| [Accessibility Audit](./accessibility)   | Run audits, identify violations, verify fixes                                |

## How to use these recipes

These recipes are written as sequences of tool calls with example responses. In practice, you just describe what you want in natural language:

> "Take a snapshot of the current screen and find the login button"

> "Mock the /api/users endpoint to return an error, then check what happens"

> "Profile the renders while I scroll through the product list"

The AI will translate your request into the appropriate tool calls automatically.
