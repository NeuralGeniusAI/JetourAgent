"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { v4 as uuidv4 } from "uuid";
import { COMPANY_LOGO, COMPANY_NAME, INITIAL_MESSAGE } from "./lib/constants";

interface Message {
  id: string | number;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const Home = () => {
  const [mensaje, setMensaje] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showCards, setShowCards] = useState(true);
  const [isTyping, setIsTyping] = useState(false); // Nuevo estado para el indicador de typing
  const [conversationId, setConversationId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setConversationId(uuidv4());
  }, []);

  const enviarMensaje = async () => {
    if (!mensaje.trim()) return;

    // Agregar mensaje del usuario
    const userMessage: Message = {
      id: Date.now(),
      text: mensaje,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setShowCards(false);
    setIsTyping(true); // Mostrar el indicador de typing

    // Limpiar input
    const currentMessage = mensaje;
    setMensaje("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: currentMessage,
          conversationId: conversationId,
        }),
      });

      if (!res.body) {
        throw new Error("No se pudo obtener la respuesta del servidor.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let aiMessageText = "";

      const aiMessage: Message = {
        id: uuidv4(),
        text: "",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter(Boolean);

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);

              if (parsed.type === "message") {
                aiMessageText += parsed.content;
                const cleanText = formatearMensaje(aiMessageText);

                // por id (string)
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessage.id ? { ...msg, text: cleanText } : msg
                  )
                );

                // Alternativa segura por referencia:
                // setMessages(prev =>
                //   prev.map(msg => (msg === aiMessage ? { ...msg, text: cleanText } : msg))
                // );
              }
            } catch {}
          }
        }
      }

      console.log("Respuesta completa del AI:", aiMessageText);
    } catch (error) {
      console.error("Error al enviar mensaje:", error);

      // Agregar mensaje de error
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "Error al conectar con el agente",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
    }
  };

  function formatearMensaje(texto: string): string {
    return texto
      .replace(/!\[/g, "[")
      .replace(/\[(.*?)\]/g, "$1 : ") // [texto] → texto:
      .replace(/\((.*?)\)/g, "$1") // (algo) → algo
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // **texto** → <strong>
      .replace(
        /^### (.*?)$/gm,
        "<h3 class='text-[15px] font-semibold '>$1</h3>"
      ) // ### título → <h3>
      .replace(/(https:\/\/[^\s]+)/gi, (match) => {
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(match)
          ? match // no hacer nada si es imagen
          : `<a href="${match}" target="_blank" class="text-blue-600 underline">${match}</a>`;
      })
      .replace(
        /(https:\/\/[^\s]+?\.(jpg|jpeg|png|gif|webp))/gi,
        '<img src="$1" alt="imagen" class="max-w-full rounded-md my-2" />'
      ) // imagen
      .replace(/\n/g, "<br />"); // saltos de línea
  }

  const handleCardClick = (cardTitle: string) => {
    setMensaje(
      `Hola ! Me interesa esta opción : ${cardTitle}. Quiero saber más al respecto`
    );
    setTimeout(() => {
      const userMessage: Message = {
        id: Date.now(),
        text: cardTitle,
        isUser: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setShowCards(false);
      setMensaje("");

      // Llamar a la API con el mensaje de la card
      fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: cardTitle }),
      })
        .then((res) => res.json())
        .then((data) => {
          const responseText = data.output || "Sin respuesta";
          const aiMessage: Message = {
            id: Date.now() + 1,
            text: responseText,
            isUser: false,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
        })
        .catch((error) => {
          console.error("Error al enviar mensaje:", error);
          const errorMessage: Message = {
            id: Date.now() + 1,
            text: "Error al conectar con el agente",
            isUser: false,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        });
    }, 100);
  };

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setMensaje(`Archivo adjunto: ${file.name}`);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        setMensaje(
          `Mensaje de audio grabado (${Math.round(audioBlob.size / 1024)}KB)`
        );
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceMessage = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const cards = [
    {
      title: "Propiedad en venta en Alto Paraná",
      bgColor: "bg-orange-100",
      iconBg: "bg-orange-200",
      icon: "🏠",
    },
    {
      title: "Alquiler de Departamento en Central",
      bgColor: "bg-blue-100",
      iconBg: "bg-blue-200",
      icon: "🏢",
    },
    {
      title: "Casa de 3 ambientes en Alto Paraguay",
      bgColor: "bg-green-100",
      iconBg: "bg-green-200",
      icon: "🏡",
    },
    {
      title: "Departamento en venta en Asunción",
      bgColor: "bg-pink-100",
      iconBg: "bg-pink-200",
      icon: "🏘️",
    },
  ];

  return (
    <div
      className={`h-[100vh] bg-white overflow-y-hidden ${
        messages.length === 0
          ? "flex items-center justify-center"
          : "flex flex-col"
      } p-8`}
    >
      <div
        className={`${
          messages.length === 0 ? "max-w-2xl" : "max-w-6xl w-full"
        } mx-auto ${messages.length > 0 ? "flex flex-col h-full" : ""}`}
      >
        {/* Header - solo se muestra si no hay mensajes */}
        {messages.length === 0 && (
          <div className="text-center mb-12">
            <img
              src={COMPANY_LOGO}
              alt=""
              className="mx-auto max-h-[200px] w-auto mb-10 "
            />
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Bienvenido a {COMPANY_NAME}
            </h1>
            <p className="text-gray-600 text-lg">{INITIAL_MESSAGE}</p>
          </div>
        )}

        {/* Messages Area */}
        {messages.length > 0 && (
          <div className="flex-1 mb-8 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)] min-h-[70vh]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.isUser ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg ${
                    message.isUser
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: message.isUser
                        ? message.text
                        : formatearMensaje(message.text),
                    }}
                    className="text-sm"
                  ></div>

                  <p
                    className={`text-xs mt-1 ${
                      message.isUser ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cards Grid - solo se muestra si showCards es true */}
        {/* {showCards && (
          <div className="grid grid-cols-2 gap-4 mb-12">
            {cards.map((card, index) => (
              <div
                key={index}
                onClick={() => handleCardClick(card.title)}
                className={`${card.bgColor} rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center text-lg`}
                    >
                      {card.icon}
                    </div>
                    <span className="font-medium text-gray-800 text-sm">
                      {card.title}
                    </span>
                  </div>
                  <Plus className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        )} */}

        {/* Input Section */}
        <div
          className={`relative min-w-[30vw] ${
            messages.length > 0 ? "mt-auto" : ""
          }`}
        >
          <div className="border-2 border-gray-200 rounded-2xl p-4 bg-white shadow-sm">
            <input
              type="text"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && enviarMensaje()}
              placeholder="Ingresa tu consulta..."
              className="w-full outline-none text-gray-800 placeholder-gray-500"
            />

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center space-x-4">
                {/* <button
                  onClick={handleAttachFile}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
                >
                  <Paperclip className="w-4 h-4" />
                  <span className="text-sm">Attach</span>
                </button>

                <button
                  onClick={handleVoiceMessage}
                  className={`flex items-center space-x-2 transition-colors ${
                    isRecording
                      ? "text-red-600 hover:text-red-800"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  {isRecording ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                  <span className="text-sm">
                    {isRecording ? "Stop Recording" : "Voice Message"}
                  </span>
                </button> */}

                {/* <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-800">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">Browse Prompts</span>
                </button> */}
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">
                  {mensaje.length} / 3,000
                </span>
                <Button
                  onClick={enviarMensaje}
                  size="icon"
                  className="w-8 h-8 bg-gray-200 hover:bg-gray-300 text-gray-600"
                  variant="ghost"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
