import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { apiRouter } from "./routes/api.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.use("/api", apiRouter);

app.listen(config.port, () => {
  console.log(`MediCall Person 2 server running on ${config.appUrl}`);
});

