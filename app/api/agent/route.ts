import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import * as dotenv from "dotenv";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { QdrantVectorStore } from "@langchain/qdrant";
import { createRetrieverTool } from "langchain/tools/retriever";
import { MultiQueryRetriever } from "langchain/retrievers/multi_query";
import { agent, retriever } from "@/app/lib/agent/agent";

async function searchBestAnswer(input: string) {
  let bestAnswerFromRetrieval = "";

  const eventStream = await retriever.streamEvents(input, {
    version: "v2",
  });

  for await (const event of eventStream) {
    if (event.event === "on_retriever_end") {
      bestAnswerFromRetrieval = event.data.output[0];
    }
  }

  return bestAnswerFromRetrieval;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body.input; //Input enviado por el usuario => "Hola buenos dias"
    const conversationId = body.conversationId; //Id usado para la memoria

      const SYSTEM_PROMPT = `
    Formateo ESTRICTO de enlaces e imágenes:
    - Nunca envíes HTML ni Markdown.
    - Nunca envíes URLs entre paréntesis.
    - Si compartís imágenes, devolvé SOLO las URLs directas (una por línea), sin texto extra.
    - Si compartís links que no son imagen, devolvé SOLO la URL (una por línea).
    - Nunca repitas la misma URL.
    - No devuelvas los archivos en formato lista, no los enumeres.
    `;

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          await agent.stream(
            {
              messages: [
                new HumanMessage(input),
              ],
            },
            {
              configurable: { thread_id: conversationId },
              callbacks: [
                {
                  handleLLMNewToken(token) {
                    controller.enqueue(
                      new TextEncoder().encode(
                        JSON.stringify({ type: "message", content: token }) +
                          "\n"
                      )
                    );
                  },
                  handleToolStart(tool) {
                    const name = typeof tool === "string" ? tool : tool.name;
                    console.log(`🛠️ Tool START -> ${name}`);
                  },
                  handleToolEnd(result) {
                    if (result.msg != undefined) {
                      console.log("Resultado : ", result);
                      controller.enqueue(
                        new TextEncoder().encode(
                          JSON.stringify({
                            type: "message",
                            content: result.msg.content,
                          }) + "\n"
                        )
                      );
                    }
                  },
                  handleChainError(err) {
                    controller.error(err);
                  },
                  handleRetrieverEnd: async (event) => {
                    try {
                      const idchunk = String(event[0].id);
                      const intentMetadata = String(event[0].metadata.intent);
                      const contentBestAnswer = String(
                        event[0].metadata.response
                      );

                      controller.enqueue(
                        new TextEncoder().encode(
                          JSON.stringify({
                            type: "bestAnswer",
                            idBestAnswer: idchunk,
                            intentMetadata,
                            contentBestAnswer,
                          }) + "\n"
                        )
                      );
                    } catch (err) {
                      console.error(
                        "❌ (route.ts) Error en handleRetrieverEnd:",
                        err
                      );
                    }
                  },
                },
              ],
            }
          );
        } catch (err) {
          console.error("Error en el streaming:", err);
        } finally {
          // controller.close();
        }
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: any) {
    console.error("Error en /api/agent:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
