"use client";

import { useActionState, useState } from "react";
import { updateProfileAction, updatePasswordAction, deleteAccountAction } from "@/app/actions/settings";
import { Lock, Trash2, CheckCircle, AlertCircle, ShieldAlert } from "lucide-react";

interface SettingsFormProps {
  userEmail: string;
  initialName: string;
}

export default function SettingsForm({ userEmail, initialName }: SettingsFormProps) {
  const [profileState, profileAction, isProfilePending] = useActionState(updateProfileAction as any, { error: "", success: false, message: "" });
  const [passwordState, passwordAction, isPasswordPending] = useActionState(updatePasswordAction as any, { error: "", success: false, message: "" });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "32px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
    marginBottom: "24px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "50px",
    borderRadius: "14px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    paddingLeft: "16px",
    paddingRight: "16px",
    fontSize: "15px",
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#334155",
    marginBottom: "8px",
  };

  const primaryBtnStyle: React.CSSProperties = {
    height: "48px",
    padding: "0 24px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    setIsDeleting(true);
    await deleteAccountAction();
  };

  return (
    <div style={{ maxWidth: "800px" }}>

      {/* 1. Profile Information */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
            fontWeight: 700,
            boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
          }}>
            {(initialName || userEmail)[0].toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Profile Information
            </h2>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0" }}>
              Update your personal details and account info
            </p>
          </div>
        </div>

        <form action={profileAction} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={labelStyle}>Email Address</label>
            <div style={{ position: "relative" }}>
              <input
                type="email"
                disabled
                value={userEmail}
                style={{ ...inputStyle, background: "#f1f5f9", color: "#64748b", cursor: "not-allowed" }}
              />
              <span style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "12px",
                fontWeight: 600,
                color: "#16a34a",
                background: "#dcfce7",
                padding: "4px 10px",
                borderRadius: "20px",
              }}>
                Verified
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>
              Email address cannot be changed currently.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Full Name</label>
            <input
              type="text"
              name="name"
              defaultValue={initialName}
              required
              placeholder="Enter your full name"
              style={inputStyle}
            />
          </div>

          {profileState?.error && (
            <div style={{ background: "#fef2f2", color: "#dc2626", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", border: "1px solid #fee2e2", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={18} />
              {profileState.error}
            </div>
          )}

          {profileState?.success && (
            <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle size={18} />
              {profileState.message || "Profile updated successfully!"}
            </div>
          )}

          <div>
            <button type="submit" disabled={isProfilePending} style={{ ...primaryBtnStyle, opacity: isProfilePending ? 0.7 : 1 }}>
              {isProfilePending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Change Password */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f172a" }}>
            <Lock size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Password & Security
            </h2>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0" }}>
              Ensure your account is using a strong, unique password
            </p>
          </div>
        </div>

        <form action={passwordAction} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={labelStyle}>New Password</label>
            <input
              type="password"
              name="newPassword"
              required
              minLength={6}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={6}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {passwordState?.error && (
            <div style={{ background: "#fef2f2", color: "#dc2626", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", border: "1px solid #fee2e2", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={18} />
              {passwordState.error}
            </div>
          )}

          {passwordState?.success && (
            <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle size={18} />
              {passwordState.message || "Password updated successfully!"}
            </div>
          )}

          <div>
            <button type="submit" disabled={isPasswordPending} style={{ ...primaryBtnStyle, opacity: isPasswordPending ? 0.7 : 1 }}>
              {isPasswordPending ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Danger Zone */}
      <div style={{ ...cardStyle, border: "1px solid #fecaca", background: "#fff5f5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#dc2626", margin: 0 }}>
              Danger Zone
            </h2>
            <p style={{ fontSize: "14px", color: "#7f1d1d", margin: "4px 0 0" }}>
              Irreversible actions related to your ShortLinks account
            </p>
          </div>
        </div>

        <p style={{ fontSize: "14px", color: "#991b1b", marginBottom: "20px", lineHeight: 1.5 }}>
          Once you delete your account, all your short links, analytics data, and custom domains will be permanently erased.
        </p>

        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          style={{
            height: "44px",
            padding: "0 20px",
            borderRadius: "12px",
            border: "1px solid #fca5a5",
            background: "#ffffff",
            color: "#dc2626",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 2px 8px rgba(220,38,38,0.08)",
          }}
        >
          <Trash2 size={16} />
          Delete Account
        </button>
      </div>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.6)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999,
          padding: "16px",
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "24px",
            padding: "32px",
            maxWidth: "440px",
            width: "100%",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            border: "1px solid #e2e8f0",
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: "0 0 12px" }}>
              Delete Account?
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6, margin: "0 0 20px" }}>
              This action cannot be undone. To confirm deletion, please type <strong style={{ color: "#dc2626" }}>DELETE</strong> below:
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              style={{ ...inputStyle, marginBottom: "20px", borderColor: confirmText === "DELETE" ? "#dc2626" : "#e2e8f0" }}
            />

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setConfirmText(""); }}
                style={{
                  height: "44px",
                  padding: "0 18px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmText !== "DELETE" || isDeleting}
                onClick={handleDeleteAccount}
                style={{
                  height: "44px",
                  padding: "0 20px",
                  borderRadius: "12px",
                  border: "none",
                  background: confirmText === "DELETE" ? "#dc2626" : "#fca5a5",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: confirmText === "DELETE" ? "pointer" : "not-allowed",
                }}
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
