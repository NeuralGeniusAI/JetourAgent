// import { NextRequest, NextResponse } from "next/server";
// import { ChatOpenAI } from "@langchain/openai";
// import { HumanMessage } from "@langchain/core/messages";
// import { StateGraph } from "@langchain/langgraph";
// import { MessagesAnnotation } from "@langchain/langgraph";
// import { interrupt } from "@langchain/langgraph";
// import * as dotenv from "dotenv";

// import { ToolNode } from "@langchain/langgraph/prebuilt";

// dotenv.config();

// const tools = [];

// const toolNode: ToolNode = new ToolNode(tools);

// const model = new ChatOpenAI({
//   modelName: "gpt-4o",
//   temperature: 0,
//   openAIApiKey: process.env.OPENAI_API_KEY!,
//   streaming: false,
// }).bindTools(tools);

// // Nodo que llama al modelo
// async function callModel(state: typeof MessagesAnnotation.State) {
//   const response = await model.invoke(state.messages);
//   return { messages: [response] };
// }

// // Nodo de revisión humana
// async function humanReview(state: typeof MessagesAnnotation.State) {
//   return interrupt({
//     task: "Revisar la respuesta generada por el agente.",
//     generated: state.messages.at(-1)?.content || "",
//   });
// }

// // Construcción del flujo
// const workflow = new StateGraph(MessagesAnnotation)
//   .addNode("agent", callModel)
//   .addNode("tools", toolNode)
//   .addNode("review", humanReview)
//   .addEdge("__start__", "agent")
//   .addEdge("agent", "review")
//   .addEdge("review", "tools")
//   .addEdge("tools", "agent");

// const app = workflow.compile();

// export async function POST(req: NextRequest) {
//   const body = await req.json();
//   const threadId = body.thread_id || "default";

//   // Reanudación después de revisión humana
//   if (body.resume?.edited_text) {
//     const result = await app.invoke(
//       {}, // <-- no necesitas mensajes, se reanuda desde interrupción
//       {
//         configurable: {
//           thread_id: threadId,
//           resume: { edited_text: body.resume.edited_text },
//         },
//       }
//     );

//     const finalMessage = result.messages?.at(-1)?.content || "";
//     return NextResponse.json({ output: finalMessage });
//   }

//   // Nueva consulta inicial
//   const result = await app.invoke(
//     {
//       messages: [new HumanMessage(body.input)],
//     },
//     {
//       configurable: { thread_id: threadId },
//     }
//   );

//   if ("__type__" in result && result.__type__ === "interrupt") {
//     return NextResponse.json({ interrupt: result });
//   }

//   const finalMessage = result.messages?.at(-1)?.content || "";
//   return NextResponse.json({ output: finalMessage });
// }
