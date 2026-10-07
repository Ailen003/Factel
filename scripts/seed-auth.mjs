import "dotenv/config";
import { randomUUID } from "node:crypto";

const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
const adminName = (process.env.SEED_ADMIN_NAME ?? "Example Platform Administrator").trim();
const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
const userPassword = process.env.SEED_USER_PASSWORD?.trim();
const userCount = Number.parseInt(process.env.SEED_USER_COUNT ?? "3", 10);
const userEmailDomain = (process.env.SEED_USER_EMAIL_DOMAIN ?? "example.com").trim().toLowerCase();
const clientCount = Number.parseInt(process.env.SEED_CLIENT_COUNT ?? "3", 10);
const requestsPerClient = Number.parseInt(process.env.SEED_REQUESTS_PER_CLIENT ?? "2", 10);
const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
  throw new Error("Authentication fixtures are disabled in production unless SEED_ALLOW_PRODUCTION=true.");
}

function requiredPassword(name, value, minimumLength) {
  if (!value) throw new Error(`${name} must be configured to run the authentication seed.`);
  if (value.length < minimumLength) {
    throw new Error(`${name} must contain at least ${minimumLength} characters.`);
  }
  return value;
}

if (!Number.isInteger(userCount) || userCount < 1 || userCount > 20) {
  throw new Error("SEED_USER_COUNT must be an integer between 1 and 20.");
}
if (!Number.isInteger(clientCount) || clientCount < 0 || clientCount > 20) {
  throw new Error("SEED_CLIENT_COUNT must be an integer between 0 and 20.");
}
if (!Number.isInteger(requestsPerClient) || requestsPerClient < 0 || requestsPerClient > 10) {
  throw new Error("SEED_REQUESTS_PER_CLIENT must be an integer between 0 and 10.");
}
requiredPassword("SEED_ADMIN_PASSWORD", adminPassword, 12);
requiredPassword("SEED_USER_PASSWORD", userPassword, 8);

const fixtures = [
  {
    email: adminEmail,
    name: adminName,
    password: adminPassword,
    role: "platform_admin",
    adminProfile: "owner",
  },
  ...Array.from({ length: userCount }, (_, index) => ({
    email: `trial-${String(index + 1).padStart(2, "0")}@${userEmailDomain}`,
    name: `Example Trial User ${index + 1}`,
    password: userPassword,
    role: "trial_user",
    adminProfile: null,
  })),
];

function printPlan() {
  console.log(`Authentication seed plan: ${fixtures.length} users`);
  for (const fixture of fixtures) {
    const profile = fixture.adminProfile ? `/${fixture.adminProfile}` : "";
    console.log(`- ${fixture.role}${profile}: ${fixture.email}`);
  }
  console.log(`Client fixture plan: ${clientCount} clients per trial workspace`);
  console.log(`Service-request fixture plan: ${requestsPerClient} requests per fixture client`);
}

async function runDatabaseSeed() {
  const [{ auth }, { prisma }] = await Promise.all([
    import("../lib/auth/auth.ts"),
    import("../lib/persistence/prisma.ts"),
  ]);

  async function ensureFixture(fixture) {
    const correlationId = `seed.auth-fixtures.v1:${fixture.email}`;
    let user = await prisma.user.findUnique({ where: { email: fixture.email } });

    if (user) {
      const seedAudit = await prisma.auditEvent.findFirst({
        where: { correlationId },
        select: { id: true },
      });
      if (!seedAudit) {
        throw new Error(
          `Refusing to modify existing non-fixture account ${fixture.email}; choose an unused fixture email.`,
        );
      }
      if (user.role !== fixture.role) {
        throw new Error(
          `Fixture ${fixture.email} has role ${user.role ?? "null"}; restore it manually before rerunning the seed.`,
        );
      }
      if (
        user.adminProfile !== fixture.adminProfile &&
        user.adminProfile !== null
      ) {
        throw new Error(
          `Fixture ${fixture.email} has administrative profile ${user.adminProfile}; refusing to replace it with ${fixture.adminProfile ?? "null"}.`,
        );
      }
    }

    if (fixture.adminProfile === "owner") {
      const existingOwner = await prisma.user.findFirst({
        where: { adminProfile: "owner" },
        select: { id: true },
      });
      if (existingOwner && existingOwner.id !== user?.id) {
        throw new Error(
          `Refusing to create or replace the platform owner while seeding ${fixture.email}.`,
        );
      }
    }

    if (!user) {
      try {
        const result = await auth.api.createUser({
          body: {
            name: fixture.name,
            email: fixture.email,
            password: fixture.password,
            role: fixture.role,
          },
        });
        user = result.user;
      } catch (error) {
        throw new Error(`Failed to create authentication fixture ${fixture.email}.`, { cause: error });
      }
    }

    const credential = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential", password: { not: null } },
      select: { id: true },
    });
    if (!credential) {
      throw new Error(`Seed fixture ${fixture.email} has no credential account; refusing partial repair.`);
    }

    const activatedAt = user.trialActivatedAt ?? user.createdAt;
    const expiresAt = user.trialExpiresAt ?? new Date(activatedAt.getTime() + TRIAL_DURATION_MS);
    const currentAdminProfile = user.adminProfile ?? null;
    let workspaceId;
    await prisma.$transaction(async (transaction) => {
      if (fixture.adminProfile === "owner") {
        const existingOwner = await transaction.user.findFirst({
          where: { adminProfile: "owner", id: { not: user.id } },
          select: { id: true },
        });
        if (existingOwner) {
          throw new Error(
            `Refusing to replace the existing platform owner while seeding ${fixture.email}.`,
          );
        }
      }

      const profileChanged = currentAdminProfile !== fixture.adminProfile;
      const updatedUser = await transaction.user.update({
        where: { id: user.id },
        data: {
          name: fixture.name,
          role: fixture.role,
          adminProfile: fixture.adminProfile,
          ...(profileChanged
            ? { adminProfileVersion: { increment: 1 } }
            : {}),
          status: "active",
          emailVerified: true,
          temporaryPasswordChangeRequired: false,
          temporaryPasswordExpiresAt: null,
          temporaryPasswordPurpose: null,
          trialActivatedAt: activatedAt,
          trialExpiresAt: expiresAt,
        },
        select: { adminProfileVersion: true },
      });

      if (profileChanged && fixture.adminProfile === "owner") {
        const operationId = randomUUID();
        const revokedSessions = (
          await transaction.session.deleteMany({ where: { userId: user.id } })
        ).count;
        await transaction.adminProfileMutation.create({
          data: {
            operationId,
            kind: "bootstrap_owner",
            targetUserId: user.id,
            fromRole: fixture.role,
            fromAdminProfile: currentAdminProfile,
            toRole: fixture.role,
            toAdminProfile: "owner",
            targetVersion: updatedUser.adminProfileVersion,
            revokedSessions,
          },
        });
        await transaction.auditEvent.create({
          data: {
            targetUserId: user.id,
            resourceType: "identity",
            resourceId: user.id,
            action: "admin.profile.bootstrap",
            outcome: "SUCCEEDED",
            correlationId: operationId,
            safeMetadata: {
              fixture: true,
              profile: "owner",
              revokedSessions,
              source: "authentication_seed",
            },
          },
        });
      }
      const workspace = await transaction.workspace.upsert({
        where: { ownerId: user.id },
        create: { ownerId: user.id },
        update: { lifecycle: "ACTIVE" },
        select: { id: true },
      });
      workspaceId = workspace.id;
      const existingAudit = await transaction.auditEvent.findFirst({
        where: { correlationId },
        select: { id: true },
      });
      if (!existingAudit) {
        await transaction.auditEvent.create({
          data: {
            workspaceId: workspace.id,
            targetUserId: user.id,
            resourceType: "identity",
            resourceId: user.id,
            action: "seed.user.ensure",
            outcome: "SUCCEEDED",
            correlationId,
            safeMetadata: {
              fixtureRole: fixture.role,
              fixtureAdminProfile: fixture.adminProfile,
            },
          },
        });
      }
    });

    return { userId: user.id, workspaceId };
  }

  const clientNames = ["Ada Lovelace", "Grace Hopper", "Linus Torvalds", "Katherine Johnson", "Alan Turing"];

  async function ensureClientFixtures({ userId, workspaceId }, fixture) {
    if (fixture.role !== "trial_user" || clientCount === 0) return [];

    const ensured = [];
    for (let index = 0; index < clientCount; index += 1) {
      const number = String(index + 1).padStart(2, "0");
      const operationIntent = `seed.client.v1:${fixture.email}:${number}`;
      const correlationId = operationIntent;
      const client = await prisma.$transaction(async (transaction) => {
        const existingReceipt = await transaction.operationReceipt.findUnique({
          where: { idempotencyKey: operationIntent },
          select: { id: true, workspaceId: true, actorUserId: true, outcome: true, createdClient: true },
        });

        if (existingReceipt) {
          if (
            existingReceipt.workspaceId !== workspaceId ||
            existingReceipt.actorUserId !== userId ||
            existingReceipt.outcome !== "SUCCEEDED"
          ) {
            throw new Error(`Seed client receipt ${operationIntent} does not match its fixture workspace.`);
          }
          if (!existingReceipt.createdClient) {
            throw new Error(`Seed client receipt ${operationIntent} has no created client; refusing partial repair.`);
          }
          return existingReceipt.createdClient;
        }

        const receipt = await transaction.operationReceipt.create({
          data: {
            workspaceId,
            operationIntent,
            idempotencyKey: operationIntent,
            origin: "MANUAL",
            outcome: "PENDING",
            actorUserId: userId,
          },
        });
        const email = `client-${number}@${userEmailDomain}`;
        const phone = `+1202555${String(index + 1).padStart(4, "0")}`;
        const created = await transaction.client.create({
          data: {
            workspaceId,
            name: clientNames[index % clientNames.length],
            email,
            normalizedEmail: email.toLowerCase(),
            phone,
            normalizedPhone: phone,
            company: `Example Studio ${index + 1}`,
            address: `${100 + index} Demo Avenue`,
            notes: "Synthetic seed fixture for local demonstrations.",
            creationOperationId: receipt.id,
            createdByUserId: userId,
            updatedByUserId: userId,
          },
        });
        await transaction.operationReceipt.update({
          where: { id: receipt.id },
          data: {
            selectedClientId: created.id,
            resultRequestIds: [],
            outcome: "SUCCEEDED",
            completedAt: new Date(),
          },
        });
        await transaction.auditEvent.create({
          data: {
            workspaceId,
            actorUserId: userId,
            resourceType: "client",
            resourceId: created.id,
            action: "seed.client.ensure",
            outcome: "SUCCEEDED",
            correlationId,
            safeMetadata: { fixture: true, fixtureRole: fixture.role, index: index + 1 },
          },
        });
        return created;
      });
      ensured.push(client);
      console.log(`- client fixture: ${fixture.email} / ${client.email}`);
    }
    return ensured;
  }

  const requestTitles = ["Install office network", "Repair intermittent connection", "Preventive equipment maintenance", "Inspect service panel"];
  const requestTypes = ["INSTALLATION", "REPAIR", "MAINTENANCE", "INSPECTION"];
  const requestPriorities = ["NORMAL", "HIGH", "LOW"];
  const requestStatuses = ["PENDING", "IN_PROGRESS", "RESOLVED", "CANCELLED"];

  async function ensureServiceRequestFixtures({ userId, workspaceId }, fixture, clients) {
    if (fixture.role !== "trial_user" || requestsPerClient === 0) return 0;
    let ensured = 0;
    for (const [clientIndex, client] of clients.entries()) {
      for (let requestIndex = 0; requestIndex < requestsPerClient; requestIndex += 1) {
        const operationIntent = `seed.request.v1:${fixture.email}:${clientIndex + 1}:${requestIndex + 1}`;
        const created = await prisma.$transaction(async (transaction) => {
          const existingReceipt = await transaction.operationReceipt.findUnique({
            where: { idempotencyKey: operationIntent },
            select: { id: true, workspaceId: true, actorUserId: true, outcome: true,
              createdRequests: { select: { id: true, clientId: true, title: true } } },
          });
          if (existingReceipt) {
            if (existingReceipt.workspaceId !== workspaceId || existingReceipt.actorUserId !== userId ||
                existingReceipt.outcome !== "SUCCEEDED" || existingReceipt.createdRequests.length !== 1 ||
                existingReceipt.createdRequests[0].clientId !== client.id) {
              throw new Error(`Seed request receipt ${operationIntent} does not match its fixture workspace and client.`);
            }
            return existingReceipt.createdRequests[0];
          }
          const receipt = await transaction.operationReceipt.create({ data: {
            workspaceId, operationIntent, idempotencyKey: operationIntent, origin: "MANUAL", outcome: "PENDING",
            selectedClientId: client.id, actorUserId: userId,
          } });
          const offset = clientIndex * requestsPerClient + requestIndex;
          const request = await transaction.serviceRequest.create({ data: {
            workspaceId, clientId: client.id, title: requestTitles[offset % requestTitles.length],
            description: "Synthetic service request for local demonstrations.",
            serviceType: requestTypes[offset % requestTypes.length], priority: requestPriorities[offset % requestPriorities.length],
            status: requestStatuses[offset % requestStatuses.length], preferredSchedule: "Weekday afternoon",
            serviceAddress: `${100 + clientIndex} Demo Avenue`, nextSteps: "Confirm availability with the client.",
            creationOperationId: receipt.id, createdByUserId: userId, updatedByUserId: userId,
          } });
          await transaction.operationReceipt.update({ where: { id: receipt.id }, data: {
            resultRequestIds: [request.id], outcome: "SUCCEEDED", completedAt: new Date(),
          } });
          await transaction.auditEvent.create({ data: {
            workspaceId, actorUserId: userId, resourceType: "service_request", resourceId: request.id,
            action: "seed.service_request.ensure", outcome: "SUCCEEDED", correlationId: operationIntent,
            safeMetadata: { fixture: true, fixtureRole: fixture.role, clientIndex: clientIndex + 1, requestIndex: requestIndex + 1 },
          } });
          return request;
        });
        ensured += 1;
        console.log(`- service-request fixture: ${fixture.email} / ${created.title}`);
      }
    }
    return ensured;
  }

  try {
    const ids = [];
    for (const fixture of fixtures) ids.push(await ensureFixture(fixture));
    let clients = 0;
    let requests = 0;
    for (const [index, fixture] of fixtures.entries()) {
      const ensuredClients = await ensureClientFixtures(ids[index], fixture);
      clients += ensuredClients.length;
      requests += await ensureServiceRequestFixtures(ids[index], fixture, ensuredClients);
    }
    console.log(`Authentication seed complete: ${ids.length} users ensured, ${clients} client fixtures ensured, ${requests} service-request fixtures ensured.`);
    console.log("Credentials are the values supplied through SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD.");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.env.SEED_DRY_RUN === "true") printPlan();
else await runDatabaseSeed();
