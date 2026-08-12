import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeDBData } from "./db.js";

test("chat history keeps completed reasoning details across database hydration", () => {
  const userId = "user_chat_history";
  const result = sanitizeDBData({
    users: [{
      id: userId,
      username: "listener",
      email: "listener@example.com",
      password: "stored-password-hash",
      displayName: "Listener",
      avatarUrl: "",
      bio: "",
      favoriteGenres: [],
      createdAt: "2026-08-10T10:00:00.000Z",
    }],
    playlists: [],
    tracks: [],
    userStates: {},
    chatHistories: {
      [userId]: [{
        id: "ai_reply",
        sender: "ai",
        text: "Here is your recommendation.",
        timestamp: "2026-08-10T10:01:00.000Z",
        reasoningEffort: "high",
        reasoning: "I compared the requested styles.",
        reasoningTimeline: [
          { type: "reasoning", text: "I compared the requested styles." },
          { type: "tool", tool: "web_search", query: "new synthwave releases", resultCount: 4 },
        ],
        thinkingSeconds: 5,
      }],
    },
  });

  const restoredMessage = result.chatHistories[userId][0];
  assert.equal(restoredMessage.reasoningEffort, "high");
  assert.equal(restoredMessage.reasoning, "I compared the requested styles.");
  assert.deepEqual(restoredMessage.reasoningTimeline, [
    { type: "reasoning", text: "I compared the requested styles." },
    { type: "tool", tool: "web_search", query: "new synthwave releases", resultCount: 4 },
  ]);
  assert.equal(restoredMessage.thinkingSeconds, 5);
});

test("chat history keeps only user-owned generated image URLs", () => {
  const userId = "user_image_history";
  const baseData = {
    users: [{
      id: userId,
      username: "visual-listener",
      email: "visual@example.com",
      password: "stored-password-hash",
      displayName: "Visual Listener",
      avatarUrl: "",
      bio: "",
      favoriteGenres: [],
      createdAt: "2026-08-10T10:00:00.000Z",
    }],
    playlists: [],
    tracks: [],
    userStates: {},
  };

  const result = sanitizeDBData({
    ...baseData,
    chatHistories: {
      [userId]: [{
        id: "ai_image",
        sender: "ai" as const,
        text: "Generated with Qwen Image.",
        timestamp: "2026-08-10T10:01:00.000Z",
        imageUrl: `/uploads/${userId}/ai-image_12345678-1234-4234-8234-123456789abc.png`,
        imagePrompt: "A neon album cover",
        imageModel: "qwen/qwen-image-2512",
      }, {
        id: "ai_foreign_image",
        sender: "ai" as const,
        text: "This URL must not survive.",
        timestamp: "2026-08-10T10:02:00.000Z",
        imageUrl: "/uploads/another_user/ai-image_87654321-4321-4321-8321-cba987654321.png",
        imagePrompt: "Untrusted prompt",
        imageModel: "untrusted/model",
      }],
    },
  });

  assert.equal(result.chatHistories[userId][0].imageUrl, `/uploads/${userId}/ai-image_12345678-1234-4234-8234-123456789abc.png`);
  assert.equal(result.chatHistories[userId][0].imagePrompt, "A neon album cover");
  assert.equal(result.chatHistories[userId][0].imageModel, "qwen/qwen-image-2512");
  assert.equal(result.chatHistories[userId][1].imageUrl, undefined);
  assert.equal(result.chatHistories[userId][1].imagePrompt, undefined);
  assert.equal(result.chatHistories[userId][1].imageModel, undefined);
});
