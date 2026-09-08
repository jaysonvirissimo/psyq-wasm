# Security policy

## Supported versions

Only the latest published release receives security fixes. Patches are issued
against the current minor; there are no long-term-support branches.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private
vulnerability reporting on this repository ("Report a vulnerability" under the
Security tab), which reaches the maintainer directly.

Include the package version (`compiler.info.buildId` from a compile result is
also helpful), the browser or Node.js version, and a minimal input that
reproduces the problem.

## What to expect

- Acknowledgement within 7 days.
- An assessment and, where warranted, a fix or mitigation within 90 days of the
  report, with credit to the reporter unless they prefer otherwise.
- Coordinated disclosure: the advisory is published together with the fixed
  release.

## Threat model in brief

The preprocessor and the compiler run untrusted C and untrusted virtual headers
inside WebAssembly, in a dedicated worker, on an in-memory virtual filesystem,
with no network access and no host filesystem access. Virtual header paths are
validated (relative, no `.`/`..`, no absolute paths) and bounded by the
`maxHeaderCount` and `maxHeaderBytes` limits; preprocessor switches are limited to
an allow-list so a request cannot redirect output or read other files; the
preprocessor's own include-depth limit bounds recursive inclusion. The library
enforces source-size limits and a timeout covering both stages, and it
terminates and replaces the worker on timeout, cancellation, or crash. This bounds resource use but is not a security boundary against
vulnerabilities in the browser or WebAssembly runtime itself; treat it as one
layer of defence.

The library sends no telemetry of any kind.
