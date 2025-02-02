import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI("AIzaSyAaAEi6oMwVdqZy7eySUKO5PERwId8o2BQ");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const chat = model.startChat({
    history: [
        {
            role: "user",
            parts: [{ text: "Hello" }],
        },
        {
            role: "model",
            parts: [{ text: "Great to meet you. What would you like to know?" }],
        },
    ],
});

const result = await chat.sendMessageStream("I have 2 dogs in my house.");
for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    process.stdout.write(chunkText);
}
