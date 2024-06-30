const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const videoProcessing = require("./videoProcessing");
const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
// Increase the limit for URL-encoded payloads
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.json());
app.use(cors());
// Serve processed videos
app.use(
  "/processed-videos",
  express.static(path.join(__dirname, "processed-videos"))
);

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
    const sceneResults = await Promise.all(
      processedScenes.map(async (scene) => ({
        orderIndex: scene.orderIndex,
        videoData: await fs.promises.readFile(scene.path, {
          encoding: "base64",
        }),
      }))
    );

    res.json({ processedScenes: sceneResults });
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
