// TikTok Audio MCP
// Supports MCP POST requests and browser-friendly GET requests for testing.

import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

async function getClipxAudioUrl(tiktokUrl) {
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

    return audioUrl;
}

function createServer() {
    const server = new McpServer({
        name: "tiktok-transcriber",
        version: "1.0.0"
    });

    server.registerTool(
        "get_tiktok_audio",
        {
            description: "Fetch the audio URL from a TikTok video URL.",
            inputSchema: z.object({
                tiktokUrl: z.string().url()
            })
        },
        async ({ tiktokUrl }) => {
            const audioUrl = await getClipxAudioUrl(tiktokUrl);

            return {
                content: [
                    {
                        type: "text",
                        text: audioUrl
                    }
                ]
            };
        }
    );

    return server;
}

export default {
    async fetch(request, environment, context) {
        const requestUrl = new URL(request.url);

        if (request.method === "GET" && requestUrl.pathname === "/mcp") {
            const tiktokUrl = requestUrl.searchParams.get("url");

            if (!tiktokUrl) {
                return Response.json({
                    status: "ok",
                    message: "MCP endpoint is online."
                });
            }

            try {
                const audioUrl = await getClipxAudioUrl(tiktokUrl);

                return Response.json({
                    status: "ok",
                    audioUrl: audioUrl
                });
            } catch (error) {
                return Response.json(
                    {
                        status: "error",
                        message: error instanceof Error ? error.message : String(error)
                    },
                    {
                        status: 502
                    }
                );
            }
        }

        return createMcpHandler(createServer)(request, environment, context);
    }
};
