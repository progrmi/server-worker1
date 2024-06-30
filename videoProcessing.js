// videoProcessing.js
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const utils = require("./utils");

ffmpeg.setFfprobePath(path.join("C:", "ffmpeg", "bin", "ffprobe.exe"));
ffmpeg.setFfmpegPath(ffmpegStatic);

exports.processScenes = async (scenes, fileBuffers) => {
  const processedScenes = [];
  const tempDir = utils.createTempDirectory();

  for (let i = 0; i < scenes.length; i++) {
    const {
      paragraph,
      videoUrlOrImageFile,
      duration,
      imageFileName,
      orderIndex,
    } = scenes[i];
    const sceneVideoPath = path.join(tempDir, `scene_${i}.mp4`);

    if (typeof videoUrlOrImageFile === "string") {
      // It's a video URL
      const downloadedFilePath = path.join(tempDir, `downloaded_${i}.mp4`);
      await utils.downloadVideo(videoUrlOrImageFile, downloadedFilePath);
      await processVideo(downloadedFilePath, sceneVideoPath, duration);
    } else if (imageFileName && fileBuffers[imageFileName]) {
      // It's an image file
      const imageBuffer = fileBuffers[imageFileName];
      const tempImagePath = path.join(tempDir, `image_${i}`);
      fs.writeFileSync(tempImagePath, imageBuffer);
      await processImage(tempImagePath, sceneVideoPath, duration);
      fs.unlinkSync(tempImagePath); // Clean up the temporary image file
    } else {
      console.warn(
        `Missing or invalid file for scene ${i}. Skipping this scene.`
      );
      continue; // Skip this scene
    }

    processedScenes.push({ path: sceneVideoPath, orderIndex });
  }

  return processedScenes;
};

const processVideo = async (inputPath, outputPath, duration) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions([
        "-stream_loop",
        "-1", // Loop the input video indefinitely
      ])
      .noAudio()
      .duration(duration) // Set the output duration
      .outputOptions(["-vcodec", "libx264"])
      .output(outputPath)
      .on("start", (commandLine) => {
        console.log("Processing video with command: " + commandLine);
      })
      .on("end", () => {
        console.log("Processing video finished successfully");
        resolve();
      })
      .on("error", (err, stdout, stderr) => {
        console.error("Error: " + err.message);
        console.error("FFmpeg stderr: " + stderr);
        reject(err);
      })
      .run();
  });
};

const processImage = async (imageFilePath, sceneVideoPath, duration) => {
  return new Promise((resolve, reject) => {
    ffmpeg(imageFilePath)
      .inputOptions([`-framerate 1/${duration}`])
      .complexFilter([
        {
          filter: "scale",
          options: {
            w: 1280,
            h: 720,
            force_original_aspect_ratio: "decrease",
            flags: "fast_bilinear",
          },
          outputs: "scaled", // Add an output label for this filter
        },
        {
          filter: "split",
          inputs: "scaled", // Use the output label from the previous filter as input
          outputs: ["original", "copy"],
        },
        {
          filter: "scale",
          inputs: "copy",
          options: {
            w: 32,
            h: 18,
            force_original_aspect_ratio: "increase",
            flags: "fast_bilinear",
          },
          outputs: "scaled_copy", // Add an output label for this filter
        },
        {
          filter: "gblur",
          options: {
            sigma: 10,
          },
          inputs: "scaled_copy", // Use the output label from the previous filter as input
          outputs: "blurred",
        },
        {
          filter: "scale",
          inputs: "blurred",
          options: {
            w: 1280,
            h: 720,
            flags: "fast_bilinear",
          },
          outputs: "blurred-copy",
        },
        {
          filter: "overlay",
          options: {
            x: "(main_w-overlay_w)/2",
            y: "(main_h-overlay_h)/2",
          },
          inputs: ["blurred-copy", "original"],
          outputs: "overlaid", // Add an output label for this filter
        },
        {
          filter: "setsar",
          inputs: "overlaid", // Use the output label from the previous filter as input
          options: "1",
        },
      ])
      .outputOptions(["-c:v libx264", "-r 30", "-pix_fmt yuv420p"])
      .on("start", (commandLine) => {
        console.log("Spawned FFmpeg with command: " + commandLine);
      })
      .on("progress", (progress) => {
        console.log("Processing: " + progress.percent + "% done");
      })
      .on("end", () => {
        console.log("Processing finished successfully");
        resolve();
      })
      .on("error", (err, stdout, stderr) => {
        console.error("Error: " + err.message);
        console.error("FFmpeg stderr: " + stderr);
        reject(err);
      })
      .save(sceneVideoPath);
  });
};

exports.mergeSceneVideos = async (sceneVideos, tempDir, outputPath) => {
  const concatFilePath = utils.createConcatFile(sceneVideos, tempDir);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatFilePath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-c", "copy"])
      .output(outputPath)
      .on("start", (commandLine) => {
        console.log("Merging scene videos with command: " + commandLine);
      })
      .on("progress", (progress) => {
        console.log("Processing: " + progress.percent + "% done");
      })
      .on("end", () => {
        console.log("Merging scene videos finished successfully");
        resolve();
      })
      .on("error", (err, stdout, stderr) => {
        console.error("Error: " + err.message);
        console.error("FFmpeg stderr: " + stderr);
        reject(err);
      })
      .run();
  });
};

exports.mergeAudioWithVideo = async (videoPath, audioFilePath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioFilePath)
      .outputOptions(["-c:v", "copy", "-c:a", "aac"])
      .on("start", (commandLine) => {
        console.log("Merging audio with video:", commandLine);
      })
      .on("progress", (progress) => {
        console.log("Processing: " + progress.percent + "% done");
      })
      .on("end", () => {
        console.log("Merging audio with video finished successfully");
        resolve();
      })
      .on("error", (err, stdout, stderr) => {
        console.error("Error: " + err.message);
        console.error("FFmpeg stderr: " + stderr);
        reject(err);
      })
      .save(outputPath);
  });
};
