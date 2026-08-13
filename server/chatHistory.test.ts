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
      bannedAt: null,
      banReason: null,
      bannedBy: null,
      archivedAt: null,
      archivedBy: null,
      archiveReason: null,
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
