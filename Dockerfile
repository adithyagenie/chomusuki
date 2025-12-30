FROM public.ecr.aws/docker/library/node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
RUN corepack enable

FROM base AS builder

WORKDIR /app
ADD package.json .
ADD pnpm-lock.yaml .
ADD pnpm-workspace.yaml .
ADD prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM base
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 8000
CMD [ "pnpm", "start" ]
