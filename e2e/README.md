# End-to-end checks

Browser checks that exercise the real stack — backend, frontend and the live
MLB API — rather than stubs. They cover the things unit tests structurally
cannot: that a page actually renders, that navigation works, and that no
runtime errors reach the console.

```bash
npm run test:e2e          # starts both dev servers automatically
npm run test:e2e -- --ui  # interactive
```

These are deliberately **not** part of the default `npm test` and are a separate,
manually triggered CI job: they depend on a live third-party API, so a failure
here can mean "MLB is having a moment" rather than "this change is broken".
Assertions are therefore structural (does the chart exist, did navigation land
on the right route) and never assert specific statistics, which change daily.
