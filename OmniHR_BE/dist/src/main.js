"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const sanitize_input_pipe_1 = require("./common/pipes/sanitize-input.pipe");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    const nodeEnv = config.get("NODE_ENV") ?? "development";
    const corsOrigin = config.get("CORS_ORIGIN") ?? "http://localhost:5173";
    app.use((0, helmet_1.default)());
    app.enableCors({
        origin: corsOrigin.split(",").map((origin) => origin.trim()),
        credentials: true
    });
    app.useGlobalPipes(new sanitize_input_pipe_1.SanitizeInputPipe(), new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => new common_1.BadRequestException({
            success: false,
            message: errors
                .flatMap((error) => Object.values(error.constraints ?? {}))
                .join("; "),
            errorCode: "VALIDATION_ERROR"
        })
    }));
    if (nodeEnv !== "production") {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle("OmniHR CoreHR API")
            .setDescription("CoreHR phase 1 backend API")
            .setVersion("0.1.0")
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup("docs", app, document);
    }
    const port = Number(config.get("PORT") ?? 3000);
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map