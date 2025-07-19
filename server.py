from flask import Flask, request, send_file
from flask_cors import CORS
import torch
from diffusers import StableDiffusionPipeline # UPDATED: Using the standard pipeline
from io import BytesIO

# Initialize the Flask app
app = Flask(__name__)
# Enable Cross-Origin Resource Sharing (CORS) to allow requests from your React app
CORS(app)

# --- Model Setup ---
# UPDATED: Using a smaller, faster model to prevent memory errors.
model_id = "stabilityai/stable-diffusion-2-1-base"
# Check for available GPU (CUDA) and fall back to CPU if not available
device = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Loading model: {model_id}")
print(f"Using device: {device}")

# Load the Stable Diffusion pipeline
# This will download the model the first time you run it.
# The `torch_dtype` is set to float16 for better performance on GPUs.
pipe = StableDiffusionPipeline.from_pretrained(
    model_id, 
    torch_dtype=torch.float16
)
# Move the model to the selected device (GPU or CPU)
pipe = pipe.to(device)

print("Model loaded successfully!")

# --- API Endpoint ---
@app.route('/generate', methods=['POST'])
def generate():
    # Get the prompt from the incoming JSON request
    data = request.get_json()
    prompt = data.get('prompt')

    if not prompt:
        return {"error": "Prompt is missing"}, 400

    print(f"Generating image for prompt: {prompt}")

    try:
        # Generate the image using the pipeline
        # `num_inference_steps` controls quality vs. speed. 25-30 is a good balance.
        image = pipe(prompt=prompt, num_inference_steps=30).images[0]

        # Save the image to a memory buffer
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)

        print("Image generated successfully.")

        # Send the image back as a file in the HTTP response
        return send_file(buffer, mimetype='image/png')

    except Exception as e:
        print(f"An error occurred: {e}")
        return {"error": str(e)}, 500

# --- Run the Server ---
if __name__ == '__main__':
    # Run the Flask app on localhost, port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)