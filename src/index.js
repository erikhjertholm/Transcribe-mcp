// TikTok Audio MCP
// Gets a direct TikTok audio URL through TikWM and supports MCP plus browser GET testing.

import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

async function getTikTokAudioUrl(tiktokUrl) {
    const apiUrl =
        "https://www.tikwm.com/api/?hd=1&url=" +
        encodeURIComponent(tiktokUrl);

    const apiResponse = await fetch(apiUrl);

    if (!apiResponse.ok) {
        throw new Error("TikWM returned HTTP " + apiResponse.status);
    }

    const apiData = await apiResponse.json();

    if (apiData.code !== 0) {
        throw new Error("TikWM error: " + apiData.msg);
    }

    const audioUrl = apiData.data?.music || apiData.data?.music_info?.play;

    if (!audioUrl) {
        throw new Error("TikWM returned no audio URL.");
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
            description: "Get the direct audio URL for a TikTok video.",
            inputSchema: z.object({
                tiktokUrl: z.string().url()
            })
        },
        async ({ tiktokUrl }) => {
            const audioUrl = await getTikTokAudioUrl(tiktokUrl);

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
                const audioUrl = await getTikTokAudioUrl(tiktokUrl);

                return Response.json({
                    status: "ok",
                    audioUrl: audioUrl
                });
            } catch (error) {
                return Response.json({
                    status: "error",
                    message: error instanceof Error ? error.message : String(error)
                }, {
                    status: 502
                });
            }
        }

        return createMcpHandler(createServer)(request, environment, context);
    }
};
