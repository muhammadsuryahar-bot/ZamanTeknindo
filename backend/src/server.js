// Entry point ini HANYA dipakai untuk development lokal
// (npm run dev:backend). Saat production di Vercel, yang dipakai
// adalah api/index.js yang membungkus app.js dengan serverless-http.
const app = require("./app");

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
