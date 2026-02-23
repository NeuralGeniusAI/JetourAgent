import { NextRequest, NextResponse } from "next/server";
import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body.input;
    const conversationId = body.conversationId;
    const phoneNumber = body.phoneNumber;
    const userName = body.userName;

    const API_KEY = process.env.NEURALGENIUS_API_KEY;
    const AGENT_NAME = process.env.NEURALGENIUS_AGENT_NAME || "jetour";

    if (!API_KEY) {
      console.error("❌ NEURALGENIUS_API_KEY no está configurada");
      return NextResponse.json(
        { error: "API key no configurada" },
        { status: 500 }
      );
    }

    console.log("🚀 Enviando mensaje a NeuralGenius API desde WhatsApp...");
    console.log("Usuario:", userName, "Teléfono:", phoneNumber);

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

    let content = response.data.content;

    console.log("✅ Respuesta recibida de NeuralGenius API");
    console.log("Content:", content);

    // Si el contenido ya viene como string de JSON, parsearlo
    if (typeof content === "string") {
      content = content
        .replace(/^\s*```(?:json)?/, "")
        .replace(/```$/, "")
        .trim();
      
      try {
        content = JSON.parse(content);
      } catch (e) {
        // Si no es JSON, crear un formato de mensaje simple
        console.log("⚠️ La respuesta no es JSON, creando formato simple");
        content = [{ type: "message", content: content }];
      }
    }

    return NextResponse.json({ messages: content });
  } catch (err: any) {
    console.error("❌ Error en /api/whatsapp:", err);
    console.error("Detalles:", err.response?.data || err.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
