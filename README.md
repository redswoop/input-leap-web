# input-leap-web

A modern web UI for configuring [InputLeap](https://github.com/input-leap/input-leap) KVM servers.

## Why

I love InputLeap. It's one of those tools that just disappears into your workflow — you forget it's there until you need to set it up on a new machine. But the Qt GUI is painful. It's fragile, it looks dated, and the rigid grid layout can't express real-world monitor arrangements. If you have a 49" ultrawide with two laptops below it, you're out of luck. If you want to tweak a client's keybindings, you have to walk over to the server and click through a cramped settings dialog.

I wanted to give back to a project that's saved me countless hours, so I built this: a web-based configuration UI that runs on the server and is accessible from any machine on your network. Configure your Mac's modifier keys from your Mac's browser, not the server's desktop.

## What it does

- **Visual topology editor** — drag-and-drop screen layout on a canvas. Screens snap to each other's edges, and split-edge links are generated automatically (e.g., two laptops sharing the bottom edge of an ultrawide).
- **Per-screen settings** — click a screen to configure its modifier key remapping, aliases, and half-duplex options.
- **Server controls** — start, stop, and restart the InputLeap server from the browser.
- **Live logs** — server output streamed via WebSocket.
- **Network accessible** — runs on `0.0.0.0:24802`, so you can configure the server from any machine on your LAN.
- **Config generation** — generates the InputLeap config file format, including range-based edge intervals that the stock GUI can't produce.

## Screenshots

*Coming soon*

## Quick start

```bash
# Clone
git clone https://github.com/redswoop/input-leap-web.git
cd input-leap-web

# Install
npm install

# Development (Vite hot reload + backend)
npm run dev

# Production
npm run build
npm start
```

Then open [http://localhost:24802](http://localhost:24802) (production) or [http://localhost:5173](http://localhost:5173) (dev).

## Requirements

- Node.js 18+
- InputLeap installed and available on `$PATH` (`input-leaps`, `input-leapc`)

## Architecture

```
Browser  <--HTTP/WS-->  Node server (:24802)  <--spawns-->  input-leaps
                              |
                        config file
```

- **Backend**: Express + WebSocket server. Reads/writes InputLeap config files, manages the server process.
- **Frontend**: Vue 3 + Vite SPA. Canvas-based layout editor with automatic edge detection.

## Config format

The UI generates standard InputLeap config files, including range-based edge mappings:

```
section: links
    ultrawide:
        down(0,50) = laptop-left
        down(50,100) = laptop-right
    laptop-left:
        up = ultrawide(0,50)
        right = laptop-right
    laptop-right:
        up = ultrawide(50,100)
        left = laptop-left
end
```

This is something the stock Qt GUI cannot express — it uses a grid that only allows one neighbor per edge.

## Project structure

```
input-leap-web/
  server.js              Express + WebSocket backend
  lib/
    config.js            InputLeap config parser/writer
    process.js           Server process manager
  client/                Vue 3 + Vite frontend
    src/
      components/
        LayoutCanvas.vue   Canvas-based topology editor
        ScreenList.vue     Screen selection list
        ScreenSettings.vue Per-screen configuration
        ServerTab.vue      Server settings page
        LogViewer.vue      Live log output
      composables/
        useConfig.js       Reactive config state
        useWebSocket.js    WebSocket connection
      lib/
        edge-detection.js  Automatic adjacency detection
```

## Status

Early development. Works for my setup (49" ultrawide + two laptops), but hasn't been widely tested. PRs welcome.

## License

MIT
