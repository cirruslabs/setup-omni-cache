# Setup omni-cache

[![CI](https://github.com/cirruslabs/setup-omni-cache/actions/workflows/ci.yml/badge.svg)](https://github.com/cirruslabs/setup-omni-cache/actions/workflows/ci.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action to install and run
[omni-cache](https://github.com/cirruslabs/omni-cache) as a background sidecar
for CI caching.

omni-cache is a multi-protocol cache sidecar that proxies cache requests to S3,
keeping cache traffic local to the runner and eliminating the need for tools to
have direct S3 credentials.

## Usage

```yaml
steps:
  - name: Setup omni-cache
    id: cache
    uses: cirruslabs/setup-omni-cache@v1
    with:
      bucket: ci-omni-cache
      s3-endpoint: ${{ secrets.S3_ENDPOINT }}
    env:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      AWS_REGION: us-east-1

  # Your build steps can now use the cache endpoint
  - name: Build with cache
    run: |
      # Configure your build tool to use the OMNI_CACHE_ADDRESS env var
      bazel build //... --remote_cache=http://$OMNI_CACHE_ADDRESS
```

## Inputs

| Input         | Required | Default           | Description                                           |
| ------------- | -------- | ----------------- | ----------------------------------------------------- |
| `bucket`      | Yes      | -                 | S3 bucket name for cache storage                      |
| `prefix`      | No       | `''`              | Prefix for cache object keys                          |
| `host`        | No       | `localhost:12321` | Listen address (host:port format)                     |
| `s3-endpoint` | No       | `''`              | S3 endpoint override (e.g., `https://s3.example.com`) |
| `version`     | No       | `latest`          | omni-cache version to install (e.g., `v0.7.0`)        |

## Outputs

| Output          | Description                            |
| --------------- | -------------------------------------- |
| `cache-address` | The resolved cache address (host:port) |
| `cache-socket`  | The Unix socket path for the cache     |
| `version`       | The installed omni-cache version       |

As a side effect, the action exports `OMNI_CACHE_ADDRESS` (host:port) for
subsequent steps in the same job. `cache-address` matches that value.

## Supported Protocols

omni-cache supports multiple caching protocols:

- **HTTP Cache** - Simple GET/PUT/POST for tools like Bazel, Gradle, cURL
- **GitHub Actions Cache v1/v2** - Compatible with actions/cache
- **Azure Blob** - For GHA v2 clients with range support
- **LLVM Cache** - gRPC-based cache for Xcode/LLVM compilers

## Post-run Statistics

When the workflow job completes, the action automatically:

1. Fetches and displays cache statistics (hits, misses, hit rate)
1. Adds a summary table to the GitHub job summary
1. Gracefully shuts down the omni-cache process

## AWS Configuration

omni-cache uses the standard AWS SDK credential chain. You can provide
credentials via:

- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `AWS_REGION`)
- IAM roles (for self-hosted runners on EC2)
- OIDC authentication with `aws-actions/configure-aws-credentials`

For S3-compatible services (e.g., MinIO or LocalStack), set the `s3-endpoint`
input to a full URL. omni-cache will use path-style S3 requests for
compatibility.

### Using OIDC Authentication

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/my-github-actions-role
      aws-region: us-east-1

  - name: Setup omni-cache
    uses: cirruslabs/setup-omni-cache@v1
    with:
      bucket: my-cache-bucket
```

## Example: Bazel with Remote Cache

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup omni-cache
        id: cache
        uses: cirruslabs/setup-omni-cache@v1
        with:
          bucket: my-bazel-cache
          prefix: bazel/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1

      - name: Build
        run: |
          bazel build //... \
            --remote_cache=http://$OMNI_CACHE_ADDRESS
```

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run bundle
```

### Test

```bash
npm test
```

### Local Testing

Create a `.env` file based on `.env.example` and run:

```bash
npm run local-action
```

## License

MIT
