# Attribution

First-party content, authored for the Syscity marketplace.

- **Source**: `examples/wasm-plugins/base64-tool` in
  [lightconsen/syscity](https://github.com/lightconsen/syscity) at `f0ba1b04e272fef23364d5d4887e5a3ec2c0be47`.
- **Binary**: `base64-tool.wasm`, built with
  `cargo build --release --target wasm32-unknown-unknown` from that source.
  Rebuild and re-commit it whenever the source changes — the archive ships the
  binary, so a stale `.wasm` here is what users run.
- **License**: MIT (the plugin's own code). It links `base64`, `serde` and
  `serde_json`, all MIT/Apache-2.0.
- The plugin declares no permissions: it performs pure computation and imports
  no host functions, so it cannot reach the filesystem, the network, or the
  agent's memory.
