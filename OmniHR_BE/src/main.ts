import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { SanitizeInputPipe } from "./common/pipes/sanitize-input.pipe";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>("NODE_ENV") ?? "development";
  const corsOrigin = config.get<string>("CORS_ORIGIN") ?? "http://localhost:5173";

  app.use(helmet());
  app.enableCors({
    origin: corsOrigin.split(",").map((origin) => origin.trim()),
    credentials: true
  });

  app.useGlobalPipes(
    new SanitizeInputPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          success: false,
          message: errors
            .flatMap((error) => Object.values(error.constraints ?? {}))
            .join("; "),
          errorCode: "VALIDATION_ERROR"
        })
    })
  );

  if (nodeEnv !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("OmniHR CoreHR API")
      .setDescription("CoreHR phase 1 backend API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  const port = Number(config.get<string>("PORT") ?? 3000);
  await app.listen(port);
}

bootstrap();
