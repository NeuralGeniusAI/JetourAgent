import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import redis from "redis";
import { RedisClientType } from "redis";
import { createClient } from "redis";
import { ur } from "zod/v4/locales";

const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

redisClient.on("connect", () => {
  console.log("Conectado a Redis");
});

redisClient.connect().catch((err) => {
  console.error("Error al conectar a Redis:", err);
});

export const createLead = tool(
  async ({
    name,
    email,
    phone,
    comment,
  }: {
    name: string;
    email: string;
    phone: string;
    comment: string;
  }) => {
    try {
      const response = await axios.post(
        "https://jetourpy.tecnomcrm.com/api/v1/webconnector/consultas/adf",
        {
          prospect: {
            requestdate: new Date().toISOString(),
            customer: {
              comments: comment,
              contacts: [
                {
                  emails: [
                    {
                      value: email || "ejemplo@email.com",
                    },
                  ],
                  names: [
                    {
                      part: "first",
                      value: name.split(" ")[0] || "Nombre",
                    },
                    {
                      part: "last",
                      value: name.split(" ")[1] || "Apellido",
                    },
                  ],
                  phones: [
                    {
                      type: "cellphone",
                      value: phone,
                    },
                  ],
                  addresses: [
                    {
                      city: "Córdoba",
                      postalcode: "X5022",
                    },
                  ],
                },
              ],
            },
            vehicles: [
              {
                make: "Marca",
                model: "Modelo",
                trim: "Version",
                year: 2017,
              },
            ],
            provider: {
              name: {
                value: "Google Adwords",
              },
              service: "Campaña Planes Primavera",
            },
            vendor: {
              contacts: [],
              vendorname: {
                value: "vendedor@email.com.ar",
              },
            },
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          auth: {
            username: "neuralgenius@api.com",
            password: "123456",
          },
        }
      );

      return `Prospecto enviado correctamente. Status: ${response.status}`;
    } catch (error: any) {
      console.error(
        "Error enviando prospecto:",
        error?.response?.data || error.message
      );
      return "Error al enviar el prospecto";
    }
  },
  {
    name: "createLead",
    description:
      "Crea un nuevo lead en el sistema CRM. Usa esta herramienta cuando quieras crear un lead nuevo. Debes proporcionar el nombre, email y teléfono del lead.",
    schema: z.object({
      name: z.string().min(1, "El nombre es obligatorio"),
      email: z
        .string()
        .email("Email del cliente, sino tiene envia uno generico"),
      phone: z.string().min(7, "El teléfono es obligatorio"),
      Comment: z.string().describe("Resumen de la conversación con el cliente"),
    }),
  }
);
