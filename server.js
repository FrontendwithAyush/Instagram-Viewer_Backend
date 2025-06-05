const express = require("express");
const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const cors = require("cors");

async function loadCookies(page) {
  const cookies = JSON.parse(fs.readFileSync("./backend/cookies.json"));
  await page.setCookie(...cookies);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

app.get("/", (req, res) => {
  res.send("Backend is working!");
});

// New route to visit public Instagram profile
app.get("/profile/:username", async (req, res) => {
  const username = req.params.username;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await loadCookies(page); // Load your Instagram login session

    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "networkidle2",
    });

    const data = await page.evaluate(() => {
      const name = document.querySelector("h2")?.innerText;
      const bio = document.querySelectorAll("span");
      const mName = bio[11]?.innerText;
      const mBio = bio[13]?.innerText;
      const profilePics = document.querySelectorAll("img");
      const imageUrl = profilePics[0]?.src;
      const images = [];
      profilePics.forEach((img) => {
        if (img?.src) {
          images.push(img.src);
        }
      });

      // Followers, following, posts
      const stats = document.querySelectorAll("ul li span");
      const posts = stats[0]?.innerText;
      const f1stats = document.querySelectorAll("ul li a span");
      const followers = f1stats[0]?.innerText;
      const following = f1stats[3]?.innerText;
      return {
        name,
        mBio,
        mName,
        images,
        posts,
        followers,
        following,
        imageUrl,
      };
    });

    await browser.close();
    res.json(data);
  } catch (err) {
    console.error(err.message);
    await browser.close();
    res.status(500).json({ error: "Failed to load profile" });
  }
});

app.get("/proxy-image", async (req, res) => {
  const { url } = req.query;
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    res.set("Content-Type", "image/jpeg");
    res.send(response.data);
  } catch (error) {
    console.error("Proxy error:", error.message);
    res.status(500).send("Failed to load image");
  }
});

app.get("/reels/:username", async (req, res) => {
  const username = req.params.username;
  const reelVideoLinks = [];

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setUserAgent("Mozilla/5.0");
    await page.goto(`https://www.instagram.com/${username}/reels/`, {
      waitUntil: "networkidle2",
    });

    await page.waitForSelector('a[href*="/reel/"]');

    // Get all /reel/ links from the page
    const reelLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      return links
        .map((link) => link.href)
        .filter((href) => href.includes("/reel/"));
    });

    // Visit each reel and extract video src
    for (let link of reelLinks.slice(0, 5)) {
      // limit to first 5 reels for speed
      await page.goto(link, { waitUntil: "networkidle2" });

      try {
        await page.waitForSelector("video", { timeout: 5000 });

        const videoSrc = await page.evaluate(() => {
          const video = document.querySelector("video");
          return video?.src || null;
        });

        if (videoSrc) {
          reelVideoLinks.push(videoSrc);
        }
      } catch (err) {
        console.warn(`No video found for ${link}`);
      }
    }

    await browser.close();
    res.json({ reels: reelVideoLinks });
  } catch (err) {
    console.error("Error fetching Reels:", err);
    res.status(500).json({ error: "Failed to fetch Reels videos" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
