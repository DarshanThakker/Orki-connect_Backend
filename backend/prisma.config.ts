import { defineConfig } from "@prisma/config";
import { config } from "./src/config";

export default defineConfig({
    schema: "src/Database/prisma/schema.prisma",
    datasource: {
        url: config.databaseUrl!,
    },
});
