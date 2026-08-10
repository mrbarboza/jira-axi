import { loadConfig } from "./config.js";
import { createProxyServer } from "./server.js";

const config = loadConfig();
const server = createProxyServer(config);
server.listen(config.port, () => {
  process.stdout.write(`jira-axi oauth proxy listening on :${config.port}\n`);
});
