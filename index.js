import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import express from "express";
import { exec } from "child_process";
import textToSpeech from "@google-cloud/text-to-speech";
import fs from "fs/promises";
const client = new textToSpeech.TextToSpeechClient();

dotenv.config();

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message) => {
  const command = `"D:\\3D Web\\ai-avatar-backend\\rhubarb\\rhubarb.exe" -f json -o "D:\\3D Web\\ai-avatar-backend\\audios\\message_${message}.json" "D:\\3D Web\\ai-avatar-backend\\audios\\message_${message}.wav" -r phonetic`;
  await execCommand(command);
};

// Read JSON file
const readJsonTranscript = async (file) => {
  try {
    const data = await fs.readFile(file, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading JSON file ${file}:`, error);
    return [];
  }
};

// Convert audio to base64
const audioFileToBase64 = async (file) => {
  try {
    const data = await fs.readFile(file);
    return data.toString("base64");
  } catch (error) {
    console.error(`Error converting audio to base64 ${file}:`, error);
    return null;
  }
};

// Main application setup
const setupVirtualFriendApp = () => {
  // Configuration
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const app = express();
  app.use(express.json());
  app.use(cors());
  const port = process.env.PORT || 3000;

  // Helper function to parse Gemini response
  const parseResponseMessages = (responseText) => {
    try {
      const jsonMatch = responseText.match(/```json\s*(\[[\s\S]*?\])\s*```/);
      if (!jsonMatch) throw new Error("No JSON content found");

      let messages = JSON.parse(jsonMatch[1]);

      if (!Array.isArray(messages)) {
        messages = [messages];
      }

      return messages;
    } catch (error) {
      console.error("Error parsing messages:", error);
      return [
        {
          text: "I'm having trouble understanding that.",
          facialExpression: "default",
          animation: "Talking_1",
        },
      ];
    }
  };

  // Routes
  app.get("/", (req, res) => {
    res.send("Virtual Girlfriend Backend");
  });

  app.post("/chat", async (req, res) => {
    const userMessage = req.body.message;

    // Handle initial or empty message
    if (!userMessage) {
      try {
        res.send({
          messages: [
            {
              text: "Hey dear... How was your day?",
              audio: await audioFileToBase64("audios/intro_0.wav"),
              lipsync: await readJsonTranscript("audios/intro_0.json"),
              facialExpression: "smile",
              animation: "Talking_1",
            },
            {
              text: "I missed you so much... Please don't go for so long!",
              audio: await audioFileToBase64("audios/intro_1.wav"),
              lipsync: await readJsonTranscript("audios/intro_1.json"),
              facialExpression: "sad",
              animation: "Crying",
            },
          ],
        });
        return;
      } catch (error) {
        console.error("Error in initial message:", error);
      }
    }

    try {
      // Generate AI response
      const prompt = `
      You are a virtual friend. 
      Respond to the following message: "${userMessage}"
      
      Provide your response as a JSON array with the following structure:
      [
        {
          "text": "Your response text",
          "facialExpression": "smile/sad/angry/surprised/funnyFace/default",
          "animation": "Talking_0/Talking_1/Talking_2/Crying/Laughing/Rumba/Idle/Terrified/Angry"
        }
      ]

      Only use the specified facial expressions and animations without emojis. 
      Maximum 3 messages in the array.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const messages = parseResponseMessages(response.text);

      // Process messages with audio and lip sync
      const processedMessages = [];
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];

        const fileName = `audios/message_${i}.wav`;

        try {
          // Generate audio with robust error handling
          const request = {
            input: { text: message.text },
            voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
            audioConfig: { audioEncoding: "LINEAR16" },
          };

          // Modify the response handling
          const [audioResponse] = await client.synthesizeSpeech(request);

          // Ensure audioContent exists before writing
          if (audioResponse && audioResponse.audioContent) {
            await fs.writeFile(fileName, audioResponse.audioContent, "binary");

            // Process audio and generate lip sync
            await lipSyncMessage(i);

            // Add audio and lip sync data
            message.audio = await audioFileToBase64(fileName);
            message.lipsync = await readJsonTranscript(
              `audios/message_${i}.json`
            );

            processedMessages.push(message);
          } else {
            throw new Error("No audio content generated");
          }
        } catch (messageProcessingError) {
          console.error(
            `Error processing message ${i}:`,
            messageProcessingError
          );
          // Fallback message if processing fails
          processedMessages.push({
            text: "I'm having trouble responding right now.",
            facialExpression: "sad",
            animation: "Crying",
          });
        }
      }

      res.send({ messages: processedMessages });
    } catch (error) {
      console.error("Comprehensive error in chat endpoint:", error);
      res.status(500).send({
        messages: [
          {
            text: "Sorry, something went wrong.",
            facialExpression: "sad",
            animation: "Crying",
          },
        ],
      });
    }
  });

  // Start server
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });

  return app;
};

// Initialize the application
const app = setupVirtualFriendApp();
export default app;
