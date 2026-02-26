# 🎨 Leonardo AI MCP Server

A remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for [Leonardo.ai](https://leonardo.ai), powered by [Vercel](https://vercel.com).

Generate images, manage models, check generation status, upscale, create variations — all through MCP from Cursor, Claude Desktop, VS Code, or any MCP-compatible client.

## ✨ Features / Tools

| Tool | Description |
|------|-------------|
| `generate_image` | Generate images with Leonardo AI. Supports model selection, dimensions, style presets, Alchemy, PhotoReal, and Ultra mode. Polls for completion automatically. |
| `get_generation` | Get the status and results of a generation job by ID |
| `list_models` | List all available Leonardo AI platform models with IDs, names and descriptions |
| `get_user_generations` | Get recent generation jobs for a user |
| `get_user_info` | Get the authenticated user's info (username, tokens, quota) |
| `create_variation` | Create a variation, outpaint, inpaint, or unzoom of an existing image |
| `upscale_image` | Upscale a generated image to higher resolution |
| `delete_generation` | Permanently delete a generation and its images |

## 🚀 Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2Fleonardo-ai-mcp-server&env=LEONARDO_API_KEY&envDescription=Your%20Leonardo%20AI%20API%20key&project-name=leonardo-ai-mcp-server)

> Replace `YOUR_USERNAME` with your GitHub username after pushing.

### Manual Deploy

1. **Fork/clone** this repository
2. **Import** it in [Vercel](https://vercel.com/new)
3. **Set environment variable** `LEONARDO_API_KEY` with your Leonardo AI API key
4. **Enable Fluid Compute** in your Vercel project settings for optimal performance
5. **Deploy** — your MCP server will be live at `https://your-project.vercel.app/mcp`

## 🔑 Get a Leonardo AI API Key

1. Go to [Leonardo.ai](https://app.leonardo.ai)
2. Sign up / log in
3. Navigate to API Access in your settings
4. Generate an API key

## 🔌 Connect Your MCP Client

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "leonardo-ai": {
      "url": "https://your-project.vercel.app/mcp",
      "headers": {
        "x-leonardo-api-key": "YOUR_LEONARDO_API_KEY"
      }
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "leonardo-ai": {
      "url": "https://your-project.vercel.app/mcp",
      "headers": {
        "x-leonardo-api-key": "YOUR_LEONARDO_API_KEY"
      }
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to your VS Code MCP settings:

```json
{
  "mcp": {
    "servers": {
      "leonardo-ai": {
        "url": "https://your-project.vercel.app/mcp",
        "headers": {
          "x-leonardo-api-key": "YOUR_LEONARDO_API_KEY"
        }
      }
    }
  }
}
```

> **Note:** You can also set `LEONARDO_API_KEY` as an environment variable on Vercel instead of passing it as a header. If the env var is set, the header is optional.

## 🛠 Local Development

```bash
# Install dependencies
pnpm install

# Set your API key
cp .env.example .env
# Edit .env and add your LEONARDO_API_KEY

# Start local dev server
pnpm dev
```

The MCP server will be available at `http://localhost:3000/mcp`.

## 📁 Project Structure

```
├── api/
│   ├── server.ts           # MCP server with all tool definitions
│   └── leonardo-client.ts  # Leonardo AI REST API client
├── public/
│   └── index.html          # Landing page
├── package.json
├── tsconfig.json
├── vercel.json             # Vercel deployment config
├── .env.example
└── README.md
```

## 📋 API Key Options

The server resolves the Leonardo API key in this order:

1. **`x-leonardo-api-key` header** — passed by the MCP client (recommended for multi-user setups)
2. **`LEONARDO_API_KEY` env variable** — set in Vercel project settings (simpler for single-user)

## 🧪 Example Usage

Once connected, you can use natural language in your MCP client:

- *"Generate an image of a sunset over mountains in cinematic style"*
- *"List available Leonardo AI models"*
- *"Show me my recent generations"*
- *"Upscale the last generated image"*
- *"Create a variation of image xyz"*

## 📝 License

MIT
