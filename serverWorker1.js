const express = require("express");
const cors = require("cors");
const videoProcessing = require("./videoProcessing");
const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
// Increase the limit for URL-encoded payloads
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.json());
app.use(cors());

app.post("/process-scenes", async (req, res) => {
  try {
    const { scenes, fileBuffers } = req.body;
    const reconstructedFileBuffers = {};

    for (const [key, bufferObj] of Object.entries(fileBuffers)) {
      if (
        bufferObj &&
        bufferObj.type === "Buffer" &&
        Array.isArray(bufferObj.data)
      ) {
        reconstructedFileBuffers[key] = Buffer.from(bufferObj.data);
      } else {
        console.error(`Invalid buffer object for ${key}`);
      }
    }

    const processedScenes = await videoProcessing.processScenes(
      scenes,
      reconstructedFileBuffers
    );
    res.json({
      processedScenes: processedScenes.map((scene) => ({
        path: scene.path,
        orderIndex: scene.orderIndex,
      })),
    });
  } catch (error) {
    console.error("Error processing scenes:", error);
    res
      .status(500)
      .json({ error: "Failed to process scenes", details: error.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Worker server is running on port ${PORT}`);
});
