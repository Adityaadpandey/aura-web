from pydantic import BaseModel
from fastapi import FastAPI
from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer

app = FastAPI()

# Load sentiment model
sentiment_model = pipeline("sentiment-analysis")

# Load a conversational model (DialoGPT for better chat results)
tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-medium")
model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-medium")

# Keep a chat history for maintaining context
chat_history = []

class ChatRequest(BaseModel):
    input_text: str

@app.post("/chat/")
async def chat(request: ChatRequest):
    global chat_history

    input_text = request.input_text

    # Sentiment analysis
    sentiment = sentiment_model(input_text)[0]
    sentiment_label = sentiment["label"]
    sentiment_score = sentiment["score"]

    # Add user input to the chat history
    chat_history.append(tokenizer.encode(input_text, return_tensors="pt"))

    # Prepare the input by appending the conversation history
    input_ids = chat_history[0]
    for past_input in chat_history[1:]:
        input_ids = tokenizer.build_inputs_with_special_tokens(input_ids, past_input)

    # Generate a response
    outputs = model.generate(
        input_ids,
        max_length=100,
        top_k=50,
        top_p=0.9,
        temperature=0.7,
        pad_token_id=tokenizer.eos_token_id,  # Ensure EOS token is handled
    )
    response_text = tokenizer.decode(outputs[:, input_ids.shape[-1]:][0], skip_special_tokens=True)

    # Add the bot response to the chat history
    chat_history.append(outputs)

    # Reset chat history if it grows too large
    if len(chat_history) > 6:  # Limit to last 3 turns (user + bot)
        chat_history = chat_history[-6:]

    return {
        "response": response_text,
        "sentiment": {"label": sentiment_label, "score": sentiment_score},
    }
