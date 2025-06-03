const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.goto("https://www.instagram.com/accounts/login/", {
    waitUntil: "networkidle2",
  });

  console.log("👉 Please log in manually in the browser that just opened.");
  console.log(
    "⏳ After logging in, press ENTER in the terminal to save your session cookies."
  );

  // Wait for you to press Enter in terminal
  process.stdin.once("data", async () => {
    const cookies = await page.cookies();
    fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
    console.log("✅ Cookies saved to cookies.json!");
    await browser.close();
    process.exit();
  });
})();
