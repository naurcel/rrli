import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getUserInitials,
  getDefaultAvatarUrl,
  getProfileStorageKey,
} from "../../components/profile-photo.ts";
import {
  findServerAccountById,
  updateServerAccountAvatar,
} from "../../lib/auth/server-account-store.ts";

describe("RouteX: Settings Page and Profile Photo", () => {
  describe("Avatar Initials and Formatting", () => {
    it("extracts clean initials from single and multi-word names while stripping parentheses", () => {
      assert.equal(getUserInitials("Shinryu (System Admin)"), "SH");
      assert.equal(getUserInitials("Marc Rancel (Delivery Operations)"), "MR");
      assert.equal(getUserInitials("Louiza Joy (Finance)"), "LJ");
      assert.equal(getUserInitials("HR Specialist"), "HS");
      assert.equal(getUserInitials("Admin"), "AD");
      assert.equal(getUserInitials("", "ops"), "OP");
      assert.equal(getUserInitials(null, null), "U");
    });

    it("identifies canonical default avatar URLs for admin staff", () => {
      assert.equal(getDefaultAvatarUrl("admin"), "/profiles/shinryu.png");
      assert.equal(getDefaultAvatarUrl("shinryu"), "/profiles/shinryu.png");
      assert.equal(getDefaultAvatarUrl("ADMIN"), "/profiles/shinryu.png");
      assert.equal(getDefaultAvatarUrl("operations"), null);
      assert.equal(getDefaultAvatarUrl("finance"), null);
      assert.equal(getDefaultAvatarUrl(null), null);
    });

    it("generates predictable localStorage keys isolated by user ID", () => {
      assert.equal(getProfileStorageKey("usr-admin-001"), "routex.user-avatar.usr-admin-001");
      assert.equal(getProfileStorageKey("usr-ops-002"), "routex.user-avatar.usr-ops-002");
    });
  });

  describe("Server Account Profile Photo Storage", () => {
    it("saves and updates profile photo URL for an existing user account", () => {
      const userId = "usr-ops-002";
      const testAvatar = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...";

      const res = updateServerAccountAvatar(userId, testAvatar);
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.profile.avatarUrl, testAvatar);
      }

      // Verify retrieval from store
      const account = findServerAccountById(userId);
      assert.ok(account);
      assert.equal(account.avatarUrl, testAvatar);
    });

    it("allows removing a profile picture by updating to null", () => {
      const userId = "usr-ops-002";

      const res = updateServerAccountAvatar(userId, null);
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.profile.avatarUrl, null);
      }

      const account = findServerAccountById(userId);
      assert.ok(account);
      assert.equal(account.avatarUrl, null);
    });

    it("returns error response when updating avatar for nonexistent user", () => {
      const res = updateServerAccountAvatar("usr-nonexistent-999", "data:image/png;base64,abc");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.ok(res.message.includes("not found"));
      }
    });

    it("preserves admin initial profile photo without corrupting other account attributes", () => {
      const admin = findServerAccountById("usr-admin-001");
      assert.ok(admin);
      assert.equal(admin.role, "admin");
      assert.equal(admin.username, "admin");
      assert.ok(admin.avatarUrl?.includes("shinryu.png"));
    });
  });
});
