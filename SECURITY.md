# Security

This experimental app and subtitle helper are intended for a trusted local network. The helper uses an explicit IP allowlist, read-only catalogue access and a configured media root. It has no Internet-facing authentication or TLS. Do not expose its port, MiniDLNA, or the TV's developer services through router port forwarding.

Keep Developer Mode keys, credentials, local configuration and media out of Git. Restrict the helper's operating-system account to the library/database read access and cache write access it needs. A client IP allowlist is not protection against a compromised trusted device.

For a sensitive report, use the repository's private vulnerability reporting feature if enabled; otherwise contact the maintainer privately without putting exploit details or secrets in a public issue. This project has no guaranteed security response time.
