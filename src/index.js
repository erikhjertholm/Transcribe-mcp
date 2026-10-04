// TikTok Audio MCP
// Fetches TikTok audio through ClipX and returns the actual audio to the MCP client.

import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function arrayBufferToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 32768;
    let binary = "";

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

function createServer() {
    const server = new McpServer({
        name: "tiktok-transcriber",
        version: "1.0.0"
    });

    server.registerTool(
        "get_tiktok_audio",
        {
            description: "Fetch the audio from a TikTok video URL.",
            inputSchema: z.object({
                tiktokUrl: z.string().url()
            })
        },
        async ({ tiktokUrl }) => {
            const clipxUrl =
                "https://clipx.zamdev.workers.dev?url=" +
                encodeURIComponent(tiktokUrl);

            const clipxResponse = await fetch(clipxUrl);

            if (!clipxResponse.ok) {
                throw new Error("ClipX returned HTTP " + clipxResponse.status);
            }

            const clipxData = await clipxResponse.json();
            const audioUrl = clipxData?.data?.audio?.play;

            if (!audioUrl) {
                throw new Error("ClipX returned no audio URL.");
            }

            const audioResponse = await fetch(audioUrl);

            if (!audioResponse.ok) {
                throw new Error("Audio download returned HTTP " + audioResponse.status);
            }

            const audioBuffer = await audioResponse.arrayBuffer();
            const audioBase64 = arrayBufferToBase64(audioBuffer);

            const mimeType =
                audioResponse.headers.get("content-type")?.split(";")[0] ||
                "audio/mpeg";

            return {
                content: [
                    {
                        type: "audio",
                        data: audioBase64,
                        mimeType: mimeType
                    }
                ]
            };
        }
    );

    return server;
}

export default {
    fetch(request, environment, context) {
        return createMcpHandler(createServer)(request, environment, context);
    }
};
