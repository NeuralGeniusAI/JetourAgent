import { NextRequest, NextResponse } from "next/server";
import * as dotenv from "dotenv";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { agent } from "@/app/lib/agent/agent";
import { SystemMessagePromptTemplate } from "@langchain/core/prompts";

dotenv.config();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const time = Date.now();
    const input = body.input;
    const conversationId = body.conversationId;
    const phoneNumber = body.phoneNumber;
    const userName = body.userName;

    const sysMsg = `Este es el mensaje del cliente : ${input}, Nombre del cliente ${userName}, Número de Telefono del cliente : ${phoneNumber}.
     Devuelve la respuesta en un JSON, y pon los mensajes dentro de un array, separados naturalmente como si fueran mensajes diferentes.
     Deberas colocar en type: message si es texto, y si es una imagen deberas colocar un type: image y solo brindar la url sin ningun otro texto.
     Es muy importante que no brindes la respuesta en formato markdown, simplemente brindarlo en formato JSON sin ningun backsticks ni texto extra, limpio`;

    let fullResponse: any = "";

    fullResponse = await agent.invoke(
      {
        messages: [new SystemMessage(sysMsg)],
      },
      {
        configurable: { thread_id: conversationId },
      }
    );

    let content =
      fullResponse.output?.content ?? fullResponse.messages?.at(-1)?.content;

    console.log("Content preformat : ", content);

    if (typeof content === "string") {
        content = content
          .replace(/^\s*```(?:json)?/, "") // remueve ```json o ``` al principio
          .replace(/```$/, "")             // remueve ``` al final
          .trim();
      }

    let parsed = "";
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("❌ Error al parsear JSON del modelo:", e);
      return NextResponse.json(
        { error: "Formato inválido de respuesta JSON" },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: parsed });
  } catch (err: any) {
    console.error("Error en /api/agent:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
