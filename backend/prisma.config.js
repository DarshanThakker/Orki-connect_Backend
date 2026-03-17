"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@prisma/config");
const config_2 = require("./src/config");
exports.default = (0, config_1.defineConfig)({
    schema: "src/Database/prisma/schema.prisma",
    datasource: {
        url: config_2.config.databaseUrl,
    },
});
//# sourceMappingURL=prisma.config.js.map