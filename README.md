# 🤖 Gemini AI Task Manager

A modern, intelligent task management system powered by Google's Gemini AI, built with NestJS and integrated with Telegram Bot.

## ✨ Features

- **🤖 AI-Powered Task Management**: Leverage Google Gemini AI for smart task analysis, priority suggestions, and deadline recommendations
- **📱 Telegram Bot Integration**: Seamless task management through Telegram with interactive commands
- **⏰ Smart Scheduling**: Automated reminders and intelligent deadline suggestions
- **📊 Advanced Logging**: Production-ready logging with performance metrics and business event tracking
- **🔄 Semantic Versioning**: Automated version management with comprehensive changelog
- **🗄️ PostgreSQL Database**: Robust data persistence with Prisma ORM
- **🚀 Production Ready**: Comprehensive error handling, monitoring, and deployment-ready configuration

## 🛠️ Tech Stack

- **Backend**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Google Gemini API
- **Bot**: Telegram Bot API (Grammy framework)
- **Task Queue**: Bull Queue with Redis
- **Logging**: Winston with structured logging
- **Package Manager**: PNPM
- **Language**: TypeScript

## 📚 Documentation

Comprehensive documentation is available in the [`/docs`](./docs/) directory:

- **[📋 Complete Documentation Index](./docs/README.md)** - Overview of all documentation
- **[🚀 Setup Guide](./docs/setup/setup-gemini.md)** - Get started with Gemini AI setup
- **[💡 Feature Documentation](./docs/features/)** - Detailed feature explanations
- **[📈 Migration Reports](./docs/migrations/)** - Technical migration details
- **[📊 Implementation Reports](./docs/reports/)** - Development progress and fixes

## 🚀 Quick Start

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
