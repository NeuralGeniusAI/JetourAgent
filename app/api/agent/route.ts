import { NextRequest, NextResponse } from "next/server";
import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body.input;
    const conversationId = body.conversationId;

    const API_KEY = process.env.NEURALGENIUS_API_KEY;
    const AGENT_NAME = process.env.NEURALGENIUS_AGENT_NAME || "jetour";

    if (!API_KEY) {
      console.error("❌ NEURALGENIUS_API_KEY no está configurada");
      return NextResponse.json(
        { error: "API key no configurada" },
        { status: 500 }
      );
    }

    let aiMessageText = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          console.log("🚀 Enviando mensaje a NeuralGenius API...");
          
          const response = await axios.post(
            "https://agents.neuralgenius.tech/api/public/agent",
            {
              agentName: AGENT_NAME,
              message: input,
              conversationId: conversationId,
            },
            {
              headers: {
                "x-api-key": API_KEY,
                "Content-Type": "application/json",
              },
            }
          );

          const content = response.data.content;
          aiMessageText = content;

          console.log("✅ Respuesta recibida de NeuralGenius API");

          // Enviar la respuesta en formato streaming
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({ type: "message", content: content }) + "\n"
            )
          );

          // Enviar al CRM
          if (aiMessageText.trim().length > 0) {
            try {
              const crmResponse = await axios.post(
                "https://n8n.neuralgeniusai.com/webhook/jetourCRM",
                {
                  conversationId: conversationId,
                  humanMessage: input,
                  aiMessage: aiMessageText,
                }
              );
              console.log("✅ Respuesta enviada al CRM:", crmResponse.data);
            } catch (crmError) {
              console.error("❌ Error al enviar datos al CRM:", crmError);
            }
          }
        } catch (err: any) {
          console.error("❌ Error al comunicarse con NeuralGenius API:", err);
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({ 
                type: "error", 
                content: "Error al procesar tu mensaje. Por favor, intenta de nuevo." 
              }) + "\n"
            )
          );
        } finally {
          controller.close();
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
