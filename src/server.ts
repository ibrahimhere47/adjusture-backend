// Must be imported before any routes are registered — it patches Express so that
// rejected promises in async handlers are forwarded to the error middleware automatically.
import "express-async-errors";

import express from "express";
import cors from "cors";
import { corsOptions } from "./config/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.use(cors(corsOptions));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(routes);

// Must be registered last — Express identifies error middleware by its 4-argument signature.
app.use(errorHandler);

app.listen(port, () => {
  console.log(`darkroom-api listening on http://localhost:${port}`);
});
