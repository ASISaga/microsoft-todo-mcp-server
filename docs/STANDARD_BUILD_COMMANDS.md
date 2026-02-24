# Standard Build Commands

## Development

```bash
pnpm install                  # Install dependencies
pnpm run build                # Compile TypeScript → dist/
pnpm run typecheck            # Type-check without emitting
pnpm run lint                 # Prettier format check
pnpm run format               # Fix formatting
pnpm run test                 # Run test suite (Vitest)
pnpm run test:watch           # Run tests in watch mode
pnpm run ci                   # lint + typecheck + build
```

## Local Azure Functions

```bash
cp local.settings.json.example local.settings.json
# Fill in values
func start                    # Requires @azure/functions-core-tools@4
```

## Deployment

```bash
# One-time infrastructure provisioning
az deployment group create \
  --resource-group <rg> \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam

# Deploy code (handled automatically by GitHub Actions on push to main)
func azure functionapp publish <function-app-name>
```
