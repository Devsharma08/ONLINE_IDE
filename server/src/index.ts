import "./env.js";
import { createApp } from "./app.js";
import { assertRuntimeEnv } from "./config/runtime.js";

assertRuntimeEnv();

const app = createApp();
const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log("server's running on port ", port);
});
