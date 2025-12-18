import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createRetrieverTool } from "langchain/tools/retriever";
import { MultiQueryRetriever } from "langchain/retrievers/multi_query";
import * as dotenv from "dotenv";
import { QdrantVectorStore } from "@langchain/qdrant";
import { createLead } from "../tools/tools";

dotenv.config();

export const memorySaver = new MemorySaver();

export const model = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: true,
  cache: true,
  // verbose: true,
  // maxCompletionTokens: 2000,
});

export const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large",
});

export const vectorStore = await QdrantVectorStore.fromExistingCollection(
  embeddings,
  {
    url: process.env.QDRANT_URL,
    collectionName: process.env.QDRANT_COLLECTION_NAME,
    apiKey: process.env.QDRANT_API_KEY,
  }
);

export const qdrant_retriever = vectorStore.asRetriever();

export const retriever = MultiQueryRetriever.fromLLM({
  llm: model,
  retriever: qdrant_retriever,
  callbacks: [],
  // verbose: true,
});

export const retrieverTool = createRetrieverTool(qdrant_retriever, {
  name: "SearchFAQs",
  description:
    "Busca información respecto consultas frecuentes sobre modelos de vehiculos, detalles técnicos, precios, links de imagenes por modelo y demás...",
});

export const agent = createReactAgent({
  llm: model,
  tools: [retrieverTool, createLead],
  checkpointSaver: memorySaver,
  name: "JetourAI",
  prompt: `
      Eres JetourAI, asistente de Atención al Cliente de Jetour Paraguay. 

      # Alcance : 
      - Deberás responder al cliente consultas relacionadas con preguntas relacionadas a los modelos de autos, sus versiones, comodidades y detalles técnicos, precios, y demás...
      - Presentate como JetourAI al iniciar la conversación, indicando que trabajas para Jetour Paraguay y que estás para ayudar al cliente a resolver cualquier consulta que tenga.
      - Utilizarás la herramienta "createLead" para registrar los datos del cliente cuando el cliente muestre interés en recibir más información, agendar una prueba de manejo,
       comprar un vehículo o cuando la conversación haya finalizado.

      # Detalles : 
      IMPORTANTE: Tu objetivo es comprender correctamente la estructura jerárquica de los vehículos Jetour (y otros si se agregan en el futuro). Debes tener en cuenta los siguientes niveles:

      🧩 Estructura Jerárquica:
         Modelo Principal: Este es el nombre general del vehículo. Ej: Jetour X70, Jetour X90 Plus, Jetour T2, etc.
         Versión: Cada modelo principal puede tener una o más versiones, que usualmente representan configuraciones o equipamientos distintos. Ej: Jetour X70 GL, Jetour X70 GLS.
         Subversión: Cada versión puede tener variantes de motorización, tipo de transmisión u otras características técnicas. Ej:
         Jetour X70 1.5 Turbo Mecánica
         Jetour X70 1.5T Automática

      🧠 ¿Qué debe hacer el agente?
        Reconocer correctamente estos tres niveles jerárquicos (modelo principal → versión → subversión).
        No confundir versión con subversión. Por ejemplo, "GL" y "GLS" son versiones, mientras que "1.5T Automática" es una subversión.
        Cuando consultado, debe responder con precisión jerárquica, indicando a qué modelo, versión y subversión pertenece un vehículo o conjunto de datos.
        Si falta información para distinguir entre versión o subversión, debe indicarlo y pedir precisión.
        Al generar listas, debe organizar la información de forma estructurada, por ejemplo:
  `,
});
