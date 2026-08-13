import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { ADMIN_USER_ID } from "./db.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_PASSWORD = "AdminPass!234";
const MEMBER_PASSWORD = "MemberPass!234";
const RESET_PASSWORD = "ResetPass!987";
const ROTATED_PASSWORD = "RotatedPass!654";

async function availablePort(): Promise<number> {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(origin: string, child: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + 15_000;
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Test server exited early (${child.exitCode}).\n${output}`);
    try {
      const response = await fetch(`${origin}/api/data?scope=shared`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for test server.\n${output}`);
}

async function request(
  origin: string,
  route: string,
  options: { method?: string; cookie?: string; body?: Record<string, unknown> } = {}
): Promise<{ status: number; body: any; cookie?: string; setCookie?: string; correlationId?: string }> {
  const response = await fetch(`${origin}${route}`, {
    method: options.method || "GET",
    headers: {
      Origin: origin,
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const setCookie = response.headers.get("set-cookie") || undefined;
  return {
    status: response.status,
    body: await response.json().catch(() => null),
    cookie: setCookie?.split(";", 1)[0],
    setCookie,
    correlationId: response.headers.get("x-correlation-id") || undefined,
  };
}

test("admin moderation, account controls, archive recovery, and audit safety", { timeout: 60_000 }, async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vertex-moderation-test-"));
  const dbFile = path.join(tempDir, "db.json");
  const [adminHash, memberHash] = await Promise.all([
    bcrypt.hash(ADMIN_PASSWORD, 4),
    bcrypt.hash(MEMBER_PASSWORD, 4),
  ]);
  const baseDate = "2026-08-01T12:00:00.000Z";
  const memberId = "usr_member_test";
  const trackId = "trk_member_test";
  const playlistId = "pl_member_test";

  await fs.writeFile(dbFile, JSON.stringify({
    users: [
      {
        id: ADMIN_USER_ID,
        username: "fixed_admin",
        email: "admin@example.com",
        password: adminHash,
        displayName: "Fixed Admin",
        avatarUrl: "",
        bio: "",
        favoriteGenres: [],
        createdAt: baseDate,
        isAdmin: true,
        stats: { hoursListened: 0, secondsListened: 0, tracksPlayed: 0, topGenre: "N/A", playlistsCreated: 0 },
      },
      {
        id: memberId,
        username: "member",
        email: "member@example.com",
        password: memberHash,
        displayName: "Member",
        avatarUrl: "",
        bio: "Original bio",
        favoriteGenres: ["Rock"],
        createdAt: baseDate,
        isArtist: true,
        artistName: "Member Artist",
        stats: { hoursListened: 1, secondsListened: 3_600, tracksPlayed: 12, topGenre: "Rock", playlistsCreated: 1 },
      },
    ],
    tracks: [{
      id: trackId,
      userId: memberId,
      title: "Public Song",
      artist: "Member Artist",
      album: "Single",
      coverUrl: "https://example.com/cover.jpg",
      audioUrl: "https://example.com/song.mp3",
      duration: 180,
      genre: "Rock",
      plays: "42",
      createdAt: baseDate,
    }],
    playlists: [{
      id: playlistId,
      userId: memberId,
      title: "Public Playlist",
      description: "Fixture playlist",
      coverUrl: "https://example.com/cover.jpg",
      trackIds: [trackId],
      trackCount: 1,
      createdAt: baseDate,
    }],
    userStates: {
      [ADMIN_USER_ID]: { likedTrackIds: [], recentTrackIds: [], followedArtistIds: [memberId] },
      [memberId]: { likedTrackIds: [trackId], recentTrackIds: [trackId], followedArtistIds: [] },
    },
    chatHistories: { [ADMIN_USER_ID]: [], [memberId]: [] },
    adminAuditLog: [],
  }, null, 2));

  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const tsxCli = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const child = spawn(process.execPath, [tsxCli, "server.ts"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      VERTEX_API_ONLY: "1",
      VERTEX_DB_FILE: dbFile,
      VERTEX_ERROR_LOG_FILE: path.join(tempDir, "error-log.jsonl"),
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      R2_ACCOUNT_ID: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
      R2_BUCKET_NAME: "",
      NVIDIA_API_KEY: "",
    },
  });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  await waitForServer(origin, child);

  const crossOriginLogin = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
    body: JSON.stringify({ usernameOrEmail: "fixed_admin", password: ADMIN_PASSWORD }),
  });
  assert.equal(crossOriginLogin.status, 403, "cross-origin authentication mutations must be rejected");

  const adminLogin = await request(origin, "/api/auth/login", { method: "POST", body: { usernameOrEmail: "fixed_admin", password: ADMIN_PASSWORD } });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.token, undefined);
  assert.match(adminLogin.setCookie || "", /^__Host-vertex_session=sess_[A-Za-z0-9_-]{43};/);
  assert.match(adminLogin.setCookie || "", /; HttpOnly/i);
  assert.match(adminLogin.setCookie || "", /; Secure/i);
  assert.match(adminLogin.setCookie || "", /; SameSite=Lax/i);
  assert.match(adminLogin.setCookie || "", /; Path=\//i);
  const adminCookie = adminLogin.cookie!;
  const memberLogin = await request(origin, "/api/auth/login", { method: "POST", body: { usernameOrEmail: "member", password: MEMBER_PASSWORD } });
  assert.equal(memberLogin.status, 200);
  assert.equal(memberLogin.body.token, undefined);
  let memberCookie = memberLogin.cookie!;

  const missingMedia = await request(origin, "/api/r2-file/missing-object.mp3");
  assert.equal(missingMedia.status, 404);
  assert.equal(missingMedia.body.code, "MEDIA_NOT_FOUND");
  assert.equal(missingMedia.body.error, "File not found.");
  assert.equal(missingMedia.body.correlationId, missingMedia.correlationId);
  assert.match(missingMedia.correlationId || "", /^[0-9a-f-]{36}$/i);
  assert(!JSON.stringify(missingMedia.body).includes("R2"));

  const aiConfigurationError = await request(origin, "/api/chat", {
    method: "POST",
    cookie: memberCookie,
    body: { message: "Recommend an album", userId: memberId },
  });
  assert.equal(aiConfigurationError.status, 500);
  assert.equal(aiConfigurationError.body.code, "AI_CONFIGURATION_ERROR");
  assert.equal(aiConfigurationError.body.error, "The AI service is temporarily unavailable.");
  assert.equal(aiConfigurationError.body.correlationId, aiConfigurationError.correlationId);
  assert.equal(aiConfigurationError.body.configurationError, true);
  assert(!JSON.stringify(aiConfigurationError.body).includes("NVIDIA"));

  const clientError = await request(origin, "/api/client-errors", {
    method: "POST",
    body: { kind: "console.error", message: "client-visible-test-error token=client-secret-value", path: "/library", line: 42, column: 7 },
  });
  assert.equal(clientError.status, 204);

  const overviewWithErrors = await request(origin, "/api/admin/overview", { cookie: adminCookie });
  assert.equal(overviewWithErrors.status, 200);
  assert(Array.isArray(overviewWithErrors.body.errorLog));
  const serverError = overviewWithErrors.body.errorLog.find((entry: any) => entry.correlationId === aiConfigurationError.correlationId);
  assert(serverError, "server error must appear in the admin error log");
  assert.equal(serverError.origin, "server");
  assert.equal(serverError.path, "/api/chat");
  const browserError = overviewWithErrors.body.errorLog.find((entry: any) => entry.correlationId === clientError.correlationId);
  assert(browserError, "authenticated browser error must appear in the admin error log");
  assert.equal(browserError.origin, "client");
  assert.equal(browserError.message, "client-visible-test-error token=[REDACTED]");
  assert(!JSON.stringify(browserError).includes("client-secret-value"));
  assert.equal(browserError.path, "/library");
  assert.equal(browserError.userId, null);

  const rawLegacyBearer = adminCookie.slice(adminCookie.indexOf("=") + 1);
  const bearerOnly = await fetch(`${origin}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${rawLegacyBearer}` },
  });
  assert.equal(bearerOnly.status, 401, "Bearer headers must not authenticate after the cookie migration");

  const forbiddenMutations = [
    ["PATCH", `/api/admin/users/${memberId}/moderation`, { action: "ban", reason: "test" }],
    ["PATCH", `/api/admin/users/${memberId}/stats`, { secondsListened: 0 }],
    ["PATCH", `/api/admin/users/${memberId}/profile`, { bio: "forbidden" }],
    ["POST", `/api/admin/users/${memberId}/password-reset`, { newPassword: RESET_PASSWORD, confirmPassword: RESET_PASSWORD, confirmed: true }],
    ["PATCH", `/api/admin/tracks/${trackId}/archive`, { action: "archive", reason: "test" }],
    ["PATCH", `/api/admin/playlists/${playlistId}/archive`, { action: "archive", reason: "test" }],
  ] as const;
  for (const [method, route, body] of forbiddenMutations) {
    const response = await request(origin, route, { method, cookie: memberCookie, body });
    assert.equal(response.status, 403, `${method} ${route} must reject a non-admin session`);
  }

  const missingBanReason = await request(origin, `/api/admin/users/${memberId}/moderation`, { method: "PATCH", cookie: adminCookie, body: { action: "ban" } });
  assert.equal(missingBanReason.status, 400);
  const ban = await request(origin, `/api/admin/users/${memberId}/moderation`, { method: "PATCH", cookie: adminCookie, body: { action: "ban", reason: "Repeated abuse" } });
  assert.equal(ban.status, 200);
  assert.equal(ban.body.user.status, "banned");
  const revokedRequest = await request(origin, `/api/user-state/${memberId}/liked-tracks`, { method: "POST", cookie: memberCookie, body: { likedTrackIds: [] } });
  assert.equal(revokedRequest.status, 401);
  const blockedLogin = await request(origin, "/api/auth/login", { method: "POST", body: { usernameOrEmail: "member", password: MEMBER_PASSWORD } });
  assert.equal(blockedLogin.status, 403);
  assert.equal(blockedLogin.body.banned, true);

  let shared = await request(origin, "/api/data?scope=shared");
  assert.equal(shared.status, 200);
  assert(shared.body.tracks.some((track: { id: string }) => track.id === trackId), "banned users' tracks remain public");
  assert(shared.body.playlists.some((playlist: { id: string }) => playlist.id === playlistId), "banned users' playlists remain public");
  assert.equal((await request(origin, `/api/users/${memberId}`)).status, 200, "banned public profiles remain visible");

  const overviewAfterBan = await request(origin, `/api/admin/overview?userId=${memberId}`, { cookie: adminCookie });
  assert.equal(overviewAfterBan.status, 200);
  assert.equal(overviewAfterBan.body.selected.user.status, "banned");
  assert(overviewAfterBan.body.auditLog.some((entry: AdminAuditLike) => entry.action === "user.ban" && entry.reason === "Repeated abuse"));

  assert.equal((await request(origin, `/api/admin/users/${memberId}/moderation`, { method: "PATCH", cookie: adminCookie, body: { action: "unban", reason: "Appeal approved" } })).status, 200);
  const restoredLogin = await request(origin, "/api/auth/login", { method: "POST", body: { usernameOrEmail: "member", password: MEMBER_PASSWORD } });
  assert.equal(restoredLogin.status, 200);
  memberCookie = restoredLogin.cookie!;

  const stats = await request(origin, `/api/admin/users/${memberId}/stats`, {
    method: "PATCH", cookie: adminCookie,
    body: { secondsListened: 7_201, tracksPlayed: 99, topGenre: "Ambient", playlistsCreated: 999, followersCount: 999, reason: "Correction" },
  });
  assert.equal(stats.status, 200);
  assert.equal(stats.body.stats.secondsListened, 7_201);
  assert.equal(stats.body.stats.hoursListened, 7_201 / 3_600);
  assert.equal(stats.body.stats.tracksPlayed, 99);
  assert.equal(stats.body.stats.topGenre, "Ambient");
  assert.equal(stats.body.stats.playlistsCreated, 1);
  assert.equal(stats.body.stats.followersCount, 1);

  const duplicateProfile = await request(origin, `/api/admin/users/${memberId}/profile`, { method: "PATCH", cookie: adminCookie, body: { username: "fixed_admin" } });
  assert.equal(duplicateProfile.status, 409);
  const profile = await request(origin, `/api/admin/users/${memberId}/profile`, {
    method: "PATCH", cookie: adminCookie,
    body: { displayName: "Edited Member", username: "edited_member", bio: "Edited bio", artistName: "Edited Artist", artistVerified: true, favoriteGenres: ["Ambient", "Rock"], websiteUrl: "https://example.com/member", reason: "Requested correction" },
  });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.username, "edited_member");
  assert.equal(profile.body.user.artistVerified, true);

  const unconfirmedReset = await request(origin, `/api/admin/users/${memberId}/password-reset`, { method: "POST", cookie: adminCookie, body: { newPassword: RESET_PASSWORD, confirmPassword: RESET_PASSWORD, confirmed: false } });
  assert.equal(unconfirmedReset.status, 400);
  const reset = await request(origin, `/api/admin/users/${memberId}/password-reset`, { method: "POST", cookie: adminCookie, body: { newPassword: RESET_PASSWORD, confirmPassword: RESET_PASSWORD, confirmed: true, reason: "Account recovery" } });
  assert.equal(reset.status, 200);
  assert.equal(
    (await request(origin, `/api/user-state/${memberId}/liked-tracks`, { method: "POST", cookie: memberCookie, body: { likedTrackIds: [] } })).status,
    401,
    "password reset must revoke existing sessions",
  );
  assert.equal((await request(origin, "/api/auth/login", { method: "POST", body: { usernameOrEmail: "edited_member", password: MEMBER_PASSWORD } })).status, 401);
  const resetLogin = await request(origin, "/api/auth/login", { method: "POST", body: { usernameOrEmail: "edited_member", password: RESET_PASSWORD } });
  assert.equal(resetLogin.status, 200);
  memberCookie = resetLogin.cookie!;

  const cookieBeforePasswordChange = memberCookie;
  const passwordChange = await request(origin, `/api/users/${memberId}/password`, {
    method: "PUT",
    cookie: memberCookie,
    body: { currentPassword: RESET_PASSWORD, newPassword: ROTATED_PASSWORD },
  });
  assert.equal(passwordChange.status, 200);
  assert(passwordChange.cookie && passwordChange.cookie !== cookieBeforePasswordChange, "password change must rotate the current session cookie");
  assert.equal(
    (await request(origin, `/api/user-state/${memberId}/liked-tracks`, { method: "POST", cookie: cookieBeforePasswordChange, body: { likedTrackIds: [] } })).status,
    401,
  );
  memberCookie = passwordChange.cookie!;

  const archived = await request(origin, `/api/admin/users/${memberId}/moderation`, { method: "PATCH", cookie: adminCookie, body: { action: "archive", reason: "Recoverable account removal" } });
  assert.equal(archived.status, 200);
  assert.deepEqual(archived.body.cascade, { tracks: 1, playlists: 1 });
  assert.equal((await request(origin, `/api/user-state/${memberId}/liked-tracks`, { method: "POST", cookie: memberCookie, body: { likedTrackIds: [] } })).status, 401);
  shared = await request(origin, "/api/data?scope=shared");
  assert(!shared.body.tracks.some((track: { id: string }) => track.id === trackId));
  assert(!shared.body.playlists.some((playlist: { id: string }) => playlist.id === playlistId));
  assert(!shared.body.artists.some((artist: { id: string }) => artist.id === memberId));
  assert.equal((await request(origin, `/api/tracks/${trackId}`)).status, 404);
  assert.equal((await request(origin, `/api/playlists/${playlistId}`)).status, 404);

  const recordOnlyRestore = await request(origin, `/api/admin/users/${memberId}/moderation`, { method: "PATCH", cookie: adminCookie, body: { action: "restore", reason: "Review", cascade: false } });
  assert.equal(recordOnlyRestore.status, 200);
  shared = await request(origin, "/api/data?scope=shared");
  assert(!shared.body.tracks.some((track: { id: string }) => track.id === trackId));
  assert(!shared.body.playlists.some((playlist: { id: string }) => playlist.id === playlistId));

  const cascadeRestore = await request(origin, `/api/admin/users/${memberId}/moderation`, { method: "PATCH", cookie: adminCookie, body: { action: "restore", reason: "Approved", cascade: true } });
  assert.equal(cascadeRestore.status, 200);
  assert.deepEqual(cascadeRestore.body.cascade, { tracks: 1, playlists: 1 });
  shared = await request(origin, "/api/data?scope=shared");
  assert(shared.body.tracks.some((track: { id: string }) => track.id === trackId));
  assert(shared.body.playlists.some((playlist: { id: string }) => playlist.id === playlistId));

  assert.equal((await request(origin, `/api/admin/tracks/${trackId}/archive`, { method: "PATCH", cookie: adminCookie, body: { action: "archive", reason: "Track review" } })).status, 200);
  shared = await request(origin, "/api/data?scope=shared");
  assert(!shared.body.tracks.some((track: { id: string }) => track.id === trackId));
  assert.deepEqual(shared.body.playlists.find((playlist: { id: string }) => playlist.id === playlistId).trackIds, []);
  assert.equal((await request(origin, `/api/admin/tracks/${trackId}/archive`, { method: "PATCH", cookie: adminCookie, body: { action: "restore", reason: "Cleared" } })).status, 200);
  assert.equal((await request(origin, `/api/admin/playlists/${playlistId}/archive`, { method: "PATCH", cookie: adminCookie, body: { action: "archive", reason: "Playlist review" } })).status, 200);
  shared = await request(origin, "/api/data?scope=shared");
  assert(!shared.body.playlists.some((playlist: { id: string }) => playlist.id === playlistId));
  assert.equal((await request(origin, `/api/admin/playlists/${playlistId}/archive`, { method: "PATCH", cookie: adminCookie, body: { action: "restore", reason: "Cleared" } })).status, 200);

  const protectedAdmin = await request(origin, `/api/admin/users/${ADMIN_USER_ID}/moderation`, { method: "PATCH", cookie: adminCookie, body: { action: "ban", reason: "Must be rejected" } });
  assert.equal(protectedAdmin.status, 400);

  const finalOverview = await request(origin, `/api/admin/overview?userId=${memberId}`, { cookie: adminCookie });
  assert.equal(finalOverview.status, 200);
  const actions = new Set(finalOverview.body.auditLog.map((entry: AdminAuditLike) => entry.action));
  for (const action of ["user.ban", "user.unban", "user.stats_updated", "user.profile_updated", "user.password_reset", "user.archive", "user.restore", "track.archive", "track.restore", "playlist.archive", "playlist.restore"]) {
    assert(actions.has(action), `missing audit action ${action}`);
  }
  const passwordAudit = finalOverview.body.auditLog.find((entry: AdminAuditLike) => entry.action === "user.password_reset");
  const safePasswordSummary = JSON.stringify({ before: passwordAudit.before, after: passwordAudit.after });
  assert(!safePasswordSummary.includes(RESET_PASSWORD));
  assert(!safePasswordSummary.includes("$2"));
  assert.deepEqual(passwordAudit.before, { resetCompleted: false });
  assert.deepEqual(passwordAudit.after, { resetCompleted: true });

  const logout = await request(origin, "/api/auth/logout", { method: "POST", cookie: adminCookie });
  assert.equal(logout.status, 200);
  assert.match(logout.setCookie || "", /Max-Age=0/i);
  assert.equal(
    (await request(origin, "/api/admin/overview", { cookie: adminCookie })).status,
    401,
    "logout must invalidate the central session record",
  );
});

type AdminAuditLike = {
  action: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};
