import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import dgram from "dgram";

function udpBridgePlugin(): Plugin {
  let socket: dgram.Socket | null = null;
  let lastSenderIp = "10.173.193.148";
  let latestPayload = "";
  const sseClients = new Set<any>();

  return {
    name: "vite-udp-bridge",
    configureServer(server) {
      try {
        socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

        socket.on("message", (msg: Buffer, rinfo: dgram.RemoteInfo) => {
          lastSenderIp = rinfo.address;
          latestPayload = msg.toString("utf8");

          // 1. Send via Vite WebSocket HMR custom event
          server.ws.send({
            type: "custom",
            event: "udp-telemetry",
            data: latestPayload,
          });

          // 2. Stream to all active SSE browser connections
          for (const res of sseClients) {
            try {
              res.write(`data: ${latestPayload}\n\n`);
            } catch {
              sseClients.delete(res);
            }
          }
        });

        socket.on("error", (err: Error) => {
          console.warn("[Vite UDP Bridge] Socket error:", err.message);
        });

        socket.bind(8888, "0.0.0.0", () => {
          console.log(`🚁 [Vite UDP Bridge] Listening on 0.0.0.0:8888 for ESP32 packets.`);
        });
      } catch (err) {
        console.warn("[Vite UDP Bridge] Failed to initialize UDP listener:", err);
      }

      // Helper to send command packets to drone UDP port 8889
      const sendToDrone = (buffer: Buffer) => {
        const client = dgram.createSocket("udp4");
        client.send(buffer, 8889, lastSenderIp, (err) => {
          if (err) console.warn("[Vite UDP Bridge] Send error:", err);
          client.close();
        });
      };

      // Server-Sent Events endpoint: /api/telemetry-stream
      server.middlewares.use("/api/telemetry-stream", (req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (typeof (res as any).flushHeaders === "function") {
          (res as any).flushHeaders();
        }

        if (latestPayload) {
          res.write(`data: ${latestPayload}\n\n`);
        }

        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
      });

      // Latest telemetry snapshot endpoint: /api/telemetry
      server.middlewares.use("/api/telemetry", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(latestPayload || "{}");
      });

      // Handle throttle via Vite WS
      server.ws.on("custom:drone-throttle", (data: { throttle: number }) => {
        const thr = Math.max(0, Math.min(100, Math.round(data.throttle)));
        sendToDrone(Buffer.from([1, thr]));
        console.log(`[Vite UDP Bridge] Throttle ${thr}% sent to ${lastSenderIp}:8889`);
      });

      // Handle E-Stop via Vite WS
      server.ws.on("custom:drone-estop", () => {
        sendToDrone(Buffer.from([2, 4]));
        console.log(`[Vite UDP Bridge] 🚨 EMERGENCY STOP sent to ${lastSenderIp}:8889`);
      });

      // Handle text command via Vite WS
      server.ws.on("custom:drone-command", (data: { command: string }) => {
        sendToDrone(Buffer.from(data.command));
        console.log(`[Vite UDP Bridge] Command "${data.command}" sent to ${lastSenderIp}:8889`);
      });

      // HTTP endpoints for throttle & e-stop
      server.middlewares.use("/api/drone/throttle", (req, res) => {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            const thr = Math.max(0, Math.min(100, Math.round(parsed.throttle)));
            sendToDrone(Buffer.from([1, thr]));
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, throttle: thr }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Invalid JSON" }));
          }
        });
      });

      server.middlewares.use("/api/drone/estop", (_req, res) => {
        sendToDrone(Buffer.from([2, 4]));
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, message: "Emergency stop sent" }));
      });

      server.httpServer?.on("close", () => {
        if (socket) {
          socket.close();
          socket = null;
        }
      });
    },
  };
}

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), udpBridgePlugin()],
  assetsInclude: ["**/*.glb"],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
