# Publishing Product Studio

## VS Code Marketplace

### Prerequisites

1. **Create a publisher account** at https://marketplace.visualstudio.com/manage
   - Sign in with a Microsoft account
   - Create a publisher (e.g., `product-engineering`)

2. **Create a Personal Access Token (PAT)** at https://dev.azure.com
   - Go to User Settings > Personal Access Tokens
   - Create a token with **Marketplace (Manage)** scope
   - Copy the token — you will need it to publish

3. **Install vsce** (VS Code Extension CLI):
   ```bash
   npm install -g @vscode/vsce
   ```

### Update package.json

Before publishing, update these fields in `package.json`:

```json
{
  "publisher": "your-publisher-id",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/product-studio-extension"
  },
  "icon": "media/icon.png"
}
```

> The marketplace icon must be a **PNG** file, at least **128x128px**. Convert the SVG at `media/icon.svg` to PNG.

### Package

```bash
vsce package
```

This creates a `.vsix` file (e.g., `product-studio-1.3.0.vsix`).

You can test it locally:

```bash
code --install-extension product-studio-1.3.0.vsix
```

### Publish

```bash
vsce login your-publisher-id
# Enter your PAT when prompted

vsce publish
```

Or publish a specific version:

```bash
vsce publish 1.3.0
```

### Update

To push a new version:

1. Update `version` in `package.json`
2. Update `CHANGELOG.md`
3. Run `vsce publish`

## Antigravity Marketplace

To publish as an Antigravity plugin, create a plugin manifest following the Antigravity plugin system:

1. Create a `plugin.json`:

   ```json
   {
     "name": "product-studio",
     "displayName": "Product Studio",
     "description": "Simplified IDE for Product Engineers",
     "version": "1.3.0",
     "skills": ["product-studio-skill"],
     "vscodeExtension": {
       "path": ".",
       "activationEvents": ["*"]
     }
   }
   ```

2. Follow the Antigravity plugin publishing guide to submit to the marketplace.

## GitHub Releases

For each version:

1. Tag the release: `git tag v1.3.0`
2. Push the tag: `git push origin v1.3.0`
3. Create a GitHub Release with the `.vsix` file attached
4. Include the relevant CHANGELOG section in the release notes
