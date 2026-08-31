# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run the Web runtime archive

GitHub Releases provide one `deepseek-harness-web-v*.tar.gz` archive for Windows, macOS, and Linux. Install Node.js 22.19 or newer (Node.js 24 is recommended), extract the archive, and run:

```sh
tar -xzf deepseek-harness-web-v*.tar.gz
cd deepseek-harness-web-v*
node install.mjs
node run.mjs web --no-open
```

Open the URL printed by the command. `install.mjs` installs optional native dependencies for the target operating system, so do not copy `node_modules` from the build machine. The archive contains no Electron shell or user data. Settings, credentials, sessions, workspaces, and the local Whisper model remain in the normal Harness home; set `DSH_HOME` to use a separate data directory.

For background service management with the same commands on Windows, macOS, and Linux, run `node start.mjs`, `node status.mjs`, and `node stop.mjs`. Pass Web options to `start.mjs`, for example `node start.mjs --port 8080`. The PID file and log are kept in `.dsh-runtime` inside the archive.

To build this release archive from a checkout, run `pnpm run release:web`. The command performs the official build and writes one `release/deepseek-harness-web-v*.tar.gz` archive; upload that file to the release page.

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
